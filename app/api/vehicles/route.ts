// app/api/vehicles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// 1. Fetch all vehicles with their latest location update
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("vehicles")
      .select(`
        *,
        vehicle_locations (
          latitude,
          longitude,
          speed,
          heading,
          battery_level,
          updated_at,
          ignition
        )
      `)
      .order("updated_at", { foreignTable: "vehicle_locations", ascending: false })
      .limit(1, { foreignTable: "vehicle_locations" });

    if (error) throw error;

    // Format the result to return location as a single object instead of an array
    const formatted = data.map((v: any) => {
      const latestLoc = v.vehicle_locations?.[0] || null;
      return {
        id: v.id,
        vehicleNumber: v.vehicle_number,
        driverName: v.driver_name,
        deviceId: v.device_id,
        status: v.status,
        createdAt: v.created_at,
        location: latestLoc,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 2. Add a new vehicle to the fleet database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vehicleNumber, driverName, deviceId, status } = body;

    if (!vehicleNumber) {
      return NextResponse.json({ error: "Vehicle registration number is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("vehicles")
      .insert({
        vehicle_number: vehicleNumber,
        driver_name: driverName || null,
        device_id: deviceId || null,
        status: status || "Active",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Vehicle number or Device ID already registered" }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
