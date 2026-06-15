-- Add landlord ownership directly to tenants so unhoused tenants (property_id IS NULL)
-- can exist while still being protected by RLS. Also loosens NOT NULL on the three
-- lease-only fields so an unhoused tenant can honestly say "no lease yet" instead of
-- carrying sentinel defaults that would render as nonsense in the UI.
--
-- Run order note: this must run before zz_canonicalize_atomic_rpc_functions.sql so the
-- canonical RPC re-application stays the final word.

BEGIN;

-- 1) Add landlord_id column on tenants, nullable so we can backfill before tightening.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS landlord_id UUID;

-- 2) Backfill from properties for any housed tenants.
UPDATE public.tenants t
SET landlord_id = p.landlord_id
FROM public.properties p
WHERE t.property_id = p.id
  AND t.landlord_id IS NULL;

-- 3) Any tenant rows still without a landlord_id at this point are orphans (property_id
--    is NULL or points to a deleted property). Bail loudly rather than silently
--    dropping them; the operator can fix the data and rerun.
DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_orphans
  FROM public.tenants
  WHERE landlord_id IS NULL;

  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'Cannot enforce tenants.landlord_id NOT NULL: % tenant rows have no resolvable landlord. Inspect the rows and either assign or delete them before rerunning this migration.', v_orphans;
  END IF;
END $$;

-- 4) Tighten ownership.
ALTER TABLE public.tenants
  ALTER COLUMN landlord_id SET NOT NULL;

-- 5) Foreign key to auth.users so deletes cascade meaningfully.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenants_landlord_id_fkey'
      AND conrelid = 'public.tenants'::regclass
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_landlord_id_fkey
      FOREIGN KEY (landlord_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6) Index for the new RLS predicate path.
CREATE INDEX IF NOT EXISTS idx_tenants_landlord_id
  ON public.tenants(landlord_id);

-- 7) Loosen NOT NULL on lease-only columns so unhoused tenants can carry NULL.
ALTER TABLE public.tenants
  ALTER COLUMN contract_months DROP NOT NULL;

ALTER TABLE public.tenants
  ALTER COLUMN rent_start_date DROP NOT NULL;

ALTER TABLE public.tenants
  ALTER COLUMN due_day DROP NOT NULL;

COMMENT ON COLUMN public.tenants.contract_months IS
'Number of billing periods agreed in the lease. NULL while the tenant is unhoused.';
COMMENT ON COLUMN public.tenants.rent_start_date IS
'First day of the lease. NULL while the tenant is unhoused.';
COMMENT ON COLUMN public.tenants.due_day IS
'Day-of-period due date pattern. NULL while the tenant is unhoused.';
COMMENT ON COLUMN public.tenants.landlord_id IS
'Owning landlord. Required even when property_id is NULL so unhoused tenants are still RLS-protected.';

-- 8) Replace the property-joined RLS policies with direct landlord_id checks.
DROP POLICY IF EXISTS "Landlords can view tenants of their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert tenants for their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update tenants of their properties" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete tenants of their properties" ON public.tenants;

DROP POLICY IF EXISTS "Landlords can view their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can insert their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can update their own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Landlords can delete their own tenants" ON public.tenants;

CREATE POLICY "Landlords can view their own tenants"
ON public.tenants FOR SELECT
TO authenticated
USING (landlord_id = auth.uid());

CREATE POLICY "Landlords can insert their own tenants"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can update their own tenants"
ON public.tenants FOR UPDATE
TO authenticated
USING (landlord_id = auth.uid())
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Landlords can delete their own tenants"
ON public.tenants FOR DELETE
TO authenticated
USING (landlord_id = auth.uid());

-- 9) Reapply create_property_atomic so it stamps landlord_id on each tenant insert.
--    Behavior is otherwise identical to the canonical zz definition.
CREATE OR REPLACE FUNCTION public.create_property_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_property properties%ROWTYPE;
  v_tenant tenants%ROWTYPE;
  v_people JSONB := '[]'::JSONB;
  v_person JSONB;
  v_tenants JSONB := '[]'::JSONB;
  v_billing_entries JSONB := '[]'::JSONB;
  v_max_tenants INTEGER := COALESCE((payload->>'maxTenants')::INTEGER, 1);
  v_occupancy_status TEXT := COALESCE(payload->>'occupancyStatus', 'vacant');
  v_tenant_ids UUID[] := ARRAY[]::UUID[];
  v_tenant_count INTEGER := 0;
  v_person_idx INTEGER := 0;
  v_due_day TEXT := COALESCE(NULLIF(payload->>'dueDay', ''), '1');
  r_schedule RECORD;
  v_period_id UUID;
  v_entry_status TEXT;
  v_total_rent NUMERIC;
  v_total_other_charges NUMERIC;
  v_rent_due NUMERIC;
  v_other_charges NUMERIC;
  v_current_tenant_id UUID;
  v_current_tenant_index INTEGER;
  v_inserted_entry billing_entries%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  INSERT INTO properties (
    landlord_id,
    unit_name,
    property_type,
    occupancy_status,
    property_location,
    rent_amount,
    max_tenants,
    bed_space_billing_mode,
    lease_date,
    notes,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    payload->>'unitName',
    payload->>'propertyType',
    v_occupancy_status,
    payload->>'propertyLocation',
    COALESCE((payload->>'rentAmount')::NUMERIC, 0),
    v_max_tenants,
    CASE WHEN v_max_tenants > 1 THEN 'per_tenant' ELSE 'unified' END,
    NULLIF(payload->>'leaseDate', '')::DATE,
    '[]',
    v_now,
    v_now
  )
  RETURNING * INTO v_property;

  IF v_occupancy_status = 'occupied' THEN
    IF jsonb_typeof(payload->'tenants') = 'array' THEN
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'name', COALESCE(elem->>'tenantName', ''),
            'email', COALESCE(elem->>'tenantEmail', ''),
            'phone', COALESCE(elem->>'contactNumber', '')
          )
        ),
        '[]'::JSONB
      )
      INTO v_people
      FROM jsonb_array_elements(payload->'tenants') AS elem
      WHERE btrim(COALESCE(elem->>'tenantName', '')) <> '';
    ELSIF btrim(COALESCE(payload->>'tenantName', '')) <> '' THEN
      v_people := jsonb_build_array(
        jsonb_build_object(
          'name', payload->>'tenantName',
          'email', COALESCE(payload->>'tenantEmail', ''),
          'phone', COALESCE(payload->>'contactNumber', '')
        )
      );
    END IF;

    IF jsonb_typeof(v_people) = 'array' THEN
      FOR v_person IN SELECT value FROM jsonb_array_elements(v_people)
      LOOP
        v_person_idx := v_person_idx + 1;

        INSERT INTO tenants (
          landlord_id,
          property_id,
          tenant_name,
          email,
          contact_number,
          tenant_slot,
          pax,
          pax_details,
          contract_months,
          billing_frequency,
          rent_per_person,
          rent_start_date,
          due_day,
          is_active,
          advance_payment,
          security_deposit,
          overflow,
          created_at,
          updated_at
        ) VALUES (
          v_user_id,
          v_property.id,
          COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
          COALESCE(v_person->>'email', ''),
          COALESCE(v_person->>'phone', ''),
          v_person_idx,
          1,
          jsonb_build_array(
            jsonb_build_object(
              'name', COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
              'email', COALESCE(v_person->>'email', ''),
              'phone', COALESCE(v_person->>'phone', '')
            )
          ),
          COALESCE((payload->>'contractMonths')::INTEGER, 0),
          COALESCE(NULLIF(payload->>'formBasis', ''), 'monthly'),
          COALESCE((payload->>'rentPerCollection')::NUMERIC, 0),
          NULLIF(payload->>'rentStartDate', '')::DATE,
          v_due_day,
          TRUE,
          COALESCE((payload->>'advancePayment')::NUMERIC, 0),
          COALESCE((payload->>'securityDeposit')::NUMERIC, 0),
          0,
          v_now,
          v_now
        )
        RETURNING * INTO v_tenant;

        v_tenants := v_tenants || jsonb_build_array(to_jsonb(v_tenant));
        v_tenant_ids := array_append(v_tenant_ids, v_tenant.id);

        IF btrim(COALESCE(v_person->>'email', '')) <> '' THEN
          BEGIN
            INSERT INTO profiles (
              email,
              full_name,
              phone,
              role,
              tenant_id,
              created_at,
              updated_at
            ) VALUES (
              COALESCE(v_person->>'email', ''),
              COALESCE(NULLIF(v_person->>'name', ''), format('Tenant %s', v_person_idx)),
              COALESCE(v_person->>'phone', ''),
              'tenant',
              v_tenant.id,
              v_now,
              v_now
            );
          EXCEPTION
            WHEN OTHERS THEN
              NULL;
          END;
        END IF;
      END LOOP;
    END IF;

    v_tenant_count := COALESCE(array_length(v_tenant_ids, 1), 0);

    IF v_tenant_count > 0
      AND jsonb_typeof(payload->'billingSchedule') = 'array'
      AND jsonb_array_length(payload->'billingSchedule') > 0
    THEN
      FOR r_schedule IN
        SELECT elem, ordinality::INTEGER
        FROM jsonb_array_elements(payload->'billingSchedule') WITH ORDINALITY AS t(elem, ordinality)
      LOOP
        v_period_id := gen_random_uuid();
        v_total_rent := COALESCE((r_schedule.elem->>'rentDue')::NUMERIC, 0);
        v_total_other_charges := COALESCE((r_schedule.elem->>'otherCharges')::NUMERIC, 0);

        FOR v_current_tenant_index IN 1..v_tenant_count LOOP
          v_current_tenant_id := v_tenant_ids[v_current_tenant_index];

          v_rent_due := COALESCE(
            NULLIF((r_schedule.elem->'tenantRentAmounts'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            NULLIF((r_schedule.elem->'tenant_rent_amounts'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            (payload->>'rentPerCollection')::NUMERIC,
            v_total_rent
          );

          v_other_charges := COALESCE(
            NULLIF((r_schedule.elem->'tenantOtherCharges'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            NULLIF((r_schedule.elem->'tenant_other_charges'->>(v_current_tenant_index - 1)::TEXT), '')::NUMERIC,
            v_total_other_charges
          );

          v_entry_status := CASE
            WHEN (COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0)) <= 0 THEN 'Not Yet Set'
            ELSE COALESCE(r_schedule.elem->>'status', 'Not Yet Due')
          END;

          INSERT INTO billing_entries (
            property_id,
            tenant_id,
            due_date,
            rent_due,
            other_charges,
            gross_due,
            status,
            expense_items,
            billing_period,
            period_id,
            paid_amount,
            tenant_rent_amounts,
            tenant_other_charges,
            tenant_payments,
            created_at,
            updated_at
          ) VALUES (
            v_property.id,
            v_current_tenant_id,
            (r_schedule.elem->>'dueDate')::DATE,
            COALESCE(v_rent_due, 0),
            COALESCE(v_other_charges, 0),
            COALESCE(v_rent_due, 0) + COALESCE(v_other_charges, 0),
            v_entry_status,
            COALESCE(r_schedule.elem->'expenseItems', '[]'::JSONB),
            r_schedule.ordinality,
            v_period_id,
            0,
            NULL,
            NULL,
            NULL,
            v_now,
            v_now
          )
          RETURNING * INTO v_inserted_entry;

          v_billing_entries := v_billing_entries || jsonb_build_array(to_jsonb(v_inserted_entry));
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'property', to_jsonb(v_property),
    'tenants', v_tenants,
    'billingEntries', v_billing_entries
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_property_atomic(JSONB) TO authenticated;

-- 10) New RPC for unhoused tenant creation. Lease fields stay NULL until assignment.
CREATE OR REPLACE FUNCTION public.create_unhoused_tenant_atomic(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_tenant_name TEXT := btrim(COALESCE(payload->>'tenantName', ''));
  v_email TEXT := COALESCE(payload->>'tenantEmail', '');
  v_contact TEXT := btrim(COALESCE(payload->>'contactNumber', ''));
  v_tenant tenants%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF v_tenant_name = '' THEN
    RAISE EXCEPTION 'Tenant name is required';
  END IF;

  IF v_contact = '' THEN
    RAISE EXCEPTION 'Contact number is required';
  END IF;

  INSERT INTO tenants (
    landlord_id,
    property_id,
    tenant_name,
    email,
    contact_number,
    tenant_slot,
    pax,
    pax_details,
    contract_months,
    rent_start_date,
    due_day,
    billing_frequency,
    rent_per_person,
    is_active,
    advance_payment,
    security_deposit,
    overflow,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    NULL,
    v_tenant_name,
    v_email,
    v_contact,
    1,
    1,
    jsonb_build_array(
      jsonb_build_object(
        'name', v_tenant_name,
        'email', v_email,
        'phone', v_contact
      )
    ),
    NULL,
    NULL,
    NULL,
    'monthly',
    0,
    TRUE,
    0,
    0,
    0,
    v_now,
    v_now
  )
  RETURNING * INTO v_tenant;

  IF v_email <> '' THEN
    BEGIN
      INSERT INTO profiles (
        email,
        full_name,
        phone,
        role,
        tenant_id,
        created_at,
        updated_at
      ) VALUES (
        v_email,
        v_tenant_name,
        v_contact,
        'tenant',
        v_tenant.id,
        v_now,
        v_now
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  BEGIN
    INSERT INTO activity_logs (
      property_id,
      tenant_id,
      user_id,
      action_type,
      description,
      metadata,
      created_at
    ) VALUES (
      NULL,
      v_tenant.id,
      v_user_id,
      'tenant_added',
      format('Unhoused tenant added: %s', v_tenant_name),
      jsonb_build_object(
        'tenant_name', v_tenant_name,
        'contact_number', v_contact,
        'has_email', v_email <> '',
        'unhoused', TRUE
      ),
      v_now
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN jsonb_build_object(
    'tenant', to_jsonb(v_tenant)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_unhoused_tenant_atomic(JSONB) TO authenticated;

COMMIT;
