-- Migration: Add location_number to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS location_number TEXT;
