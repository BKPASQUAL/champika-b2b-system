-- Add cancellation support to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
