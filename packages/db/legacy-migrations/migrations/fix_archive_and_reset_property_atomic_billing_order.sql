    -- Fix archive_and_reset_property_atomic aggregation order for billing entries.
    -- Prevents: column "billing_entries_row.billing_period" must appear in the GROUP BY clause.

    CREATE OR REPLACE FUNCTION public.archive_and_reset_property_atomic(payload JSONB)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
    AS $$
    DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := NOW();
    v_property_id UUID := NULLIF(payload->>'propertyId', '')::UUID;
    v_tenant_id UUID := NULLIF(payload->>'tenantId', '')::UUID;
    v_remarks TEXT := NULLIF(payload->>'remarks', '');
    v_property properties%ROWTYPE;
    v_tenant tenants%ROWTYPE;
    v_billing_entries JSONB := '[]'::JSONB;
    v_total_due NUMERIC := 0;
    v_total_paid NUMERIC := 0;
    v_rent_end_date DATE;
    BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF v_property_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Property and tenant are required';
    END IF;

    IF v_remarks IS NULL OR length(btrim(v_remarks)) < 10 THEN
        RAISE EXCEPTION 'Remarks must be at least 10 characters';
    END IF;

    SELECT *
    INTO v_property
    FROM properties
    WHERE id = v_property_id
        AND landlord_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    SELECT *
    INTO v_tenant
    FROM tenants
    WHERE id = v_tenant_id
        AND property_id = v_property_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant not found';
    END IF;

    SELECT COALESCE(
        jsonb_agg(to_jsonb(billing_entries_row) ORDER BY billing_entries_row.billing_period ASC),
        '[]'::JSONB
    )
    INTO v_billing_entries
    FROM billing_entries billing_entries_row
    WHERE tenant_id = v_tenant_id;

    SELECT COALESCE(SUM(gross_due), 0)
    INTO v_total_due
    FROM billing_entries
    WHERE tenant_id = v_tenant_id;

    SELECT COALESCE(SUM(
        CASE
        WHEN status ILIKE '%paid%' OR status ILIKE '%good standing%' OR status ILIKE '%settled%' THEN gross_due
        ELSE paid_amount
        END
    ), 0)
    INTO v_total_paid
    FROM billing_entries
    WHERE tenant_id = v_tenant_id;

    v_rent_end_date := (v_tenant.rent_start_date + (v_tenant.contract_months || ' months')::interval)::date;

    INSERT INTO archived_tenants (
        landlord_id,
        property_id,
        property_name,
        property_type,
        property_location,
        tenant_name,
        contact_number,
        contract_months,
        rent_start_date,
        rent_end_date,
        due_day,
        rent_amount,
        total_paid,
        total_due,
        archive_reason,
        archived_at,
        billing_entries,
        created_at
    ) VALUES (
        v_user_id,
        v_property_id,
        v_property.unit_name,
        v_property.property_type,
        v_property.property_location,
        v_tenant.tenant_name,
        v_tenant.contact_number,
        v_tenant.contract_months,
        v_tenant.rent_start_date,
        v_rent_end_date,
        v_tenant.due_day,
        v_property.rent_amount,
        v_total_paid,
        v_total_due,
        v_remarks,
        v_now,
        v_billing_entries,
        v_now
    );

    DELETE FROM billing_entries WHERE tenant_id = v_tenant_id;
    DELETE FROM tenants WHERE id = v_tenant_id;

    UPDATE properties
    SET occupancy_status = 'vacant',
        updated_at = v_now
    WHERE id = v_property_id;

    RETURN jsonb_build_object(
        'success', true,
        'propertyId', v_property_id,
        'tenantId', v_tenant_id
    );
    END;
    $$;

    GRANT EXECUTE ON FUNCTION public.archive_and_reset_property_atomic(JSONB) TO authenticated;
