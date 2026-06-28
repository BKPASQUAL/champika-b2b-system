-- supabase/migrations/create_vehicles_and_locations.sql

-- 1. Create vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_number TEXT NOT NULL UNIQUE,
    driver_name TEXT,
    device_id TEXT UNIQUE, -- Hardware IMEI
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create vehicle locations table
CREATE TABLE IF NOT EXISTS vehicle_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed REAL,
    heading REAL,
    battery_level INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Supabase Realtime updates on the vehicle_locations table
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_locations;
