-- Migration to add is_incorrect flag to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_incorrect BOOLEAN DEFAULT false;
