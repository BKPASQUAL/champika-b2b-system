-- Add 'Approved' status to order_status enum
-- New workflow: Pending -> Approved -> Processing -> Checking -> Loading -> In Transit -> Delivered
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Approved' BEFORE 'Processing';
