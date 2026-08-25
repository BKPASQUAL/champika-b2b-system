-- Migration: Track the real physical condition of a return separately from
-- its return_type, so "Exchange" returns keep displaying as "Exchange"
-- everywhere (invoices, reconcile screens) even after staff inspect the
-- item and reclassify it as Good or Damage stock.
-- Run this in Supabase SQL Editor.

ALTER TABLE inventory_returns
  ADD COLUMN IF NOT EXISTS actual_condition text;

ALTER TABLE inventory_returns
  DROP CONSTRAINT IF EXISTS inventory_returns_actual_condition_check;

ALTER TABLE inventory_returns
  ADD CONSTRAINT inventory_returns_actual_condition_check
  CHECK (actual_condition IS NULL OR actual_condition IN ('Good', 'Damage'));
