-- Add is_audited column to invoices table to track checked/audited manual bills
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_audited BOOLEAN DEFAULT FALSE;
