-- Add sub_account column to cost_center_cfoo
ALTER TABLE cost_center_cfoo ADD COLUMN IF NOT EXISTS sub_account text;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_cost_center_cfoo_sub_account ON cost_center_cfoo(sub_account);