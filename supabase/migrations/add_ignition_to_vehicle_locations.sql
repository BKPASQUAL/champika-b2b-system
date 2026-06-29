-- supabase/migrations/add_ignition_to_vehicle_locations.sql

-- Add ignition column to vehicle_locations table
ALTER TABLE public.vehicle_locations 
ADD COLUMN IF NOT EXISTS ignition BOOLEAN DEFAULT FALSE;
