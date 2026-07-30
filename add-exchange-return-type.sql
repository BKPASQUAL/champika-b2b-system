-- Migration: Add 'Exchange' to inventory_returns.return_type constraint
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing check constraint (replace constraint name if different)
ALTER TABLE inventory_returns
  DROP CONSTRAINT IF EXISTS inventory_returns_return_type_check;

-- Step 2: Add updated constraint that includes Exchange
ALTER TABLE inventory_returns
  ADD CONSTRAINT inventory_returns_return_type_check
  CHECK (return_type IN ('Good', 'Damage', 'Exchange'));
