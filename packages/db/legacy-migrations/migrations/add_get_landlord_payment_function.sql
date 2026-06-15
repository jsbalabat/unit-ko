-- Create a function to get landlord payment information for tenants
-- This function runs with SECURITY DEFINER, bypassing RLS policies
-- It only returns payment-related information, protecting other sensitive data

-- Drop the function if it exists
DROP FUNCTION IF EXISTS get_landlord_payment_info(uuid);

-- Create the function
CREATE OR REPLACE FUNCTION get_landlord_payment_info(property_id_param uuid)
RETURNS TABLE (
  payment_bank_name text,
  payment_account_name text,
  payment_account_number text,
  payment_gcash_number text,
  payment_paymaya_number text,
  payment_other_details text,
  full_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  landlord_id_var uuid;
BEGIN
  -- First, get the landlord_id from the property
  SELECT p.landlord_id INTO landlord_id_var
  FROM properties p
  WHERE p.id = property_id_param;
  
  -- If property not found, return empty result
  IF landlord_id_var IS NULL THEN
    RETURN;
  END IF;
  
  -- Return the landlord's payment information
  RETURN QUERY
  SELECT 
    pr.payment_bank_name,
    pr.payment_account_name,
    pr.payment_account_number,
    pr.payment_gcash_number,
    pr.payment_paymaya_number,
    pr.payment_other_details,
    pr.full_name
  FROM profiles pr
  WHERE pr.id = landlord_id_var;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_landlord_payment_info(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_landlord_payment_info(uuid) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_landlord_payment_info(uuid) IS 
'Returns payment information for the landlord of a given property. 
This function is SECURITY DEFINER and bypasses RLS to allow tenants to view their landlord''s payment details.
Only returns payment-related fields to protect sensitive information.';
