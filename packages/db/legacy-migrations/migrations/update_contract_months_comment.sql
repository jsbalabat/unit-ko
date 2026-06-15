-- Update comment on contract_months to clarify it represents billing periods
-- The number stored represents billing periods, which can be:
-- - Weekly periods (if billing is weekly)
-- - Bi-weekly periods (if billing is bi-weekly)
-- - Monthly periods (if billing is monthly)
-- - Quarterly periods (if billing is quarterly)
-- - Semi-annual periods (if billing is semi-annually)
-- - Annual periods (if billing is annually)

COMMENT ON COLUMN tenants.contract_months IS 'Number of billing periods in the contract. Despite the column name, this represents periods that can be weekly, monthly, quarterly, semi-annually, or annually based on the billing frequency (formBasis). For example: 6 periods with monthly billing = 6 months, 6 periods with quarterly billing = 18 months (1.5 years).';
