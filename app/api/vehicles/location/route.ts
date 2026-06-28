// app/api/vehicles/location/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    let deviceId = "";
    let latitude = 0;
    let longitude = 0;
    let speed = 0;
    let heading = 0;
    let batteryLevel: number | null = null;

    const method = request.method;

    // 1. Try parsing JSON body if it's a POST request
    if (method === "POST") {
      try {
        const body = await request.clone().json();
        
        // Handle standard Traccar JSON format (nested structure)
        if (body.device && body.position) {
          deviceId = body.device.uniqueId || String(body.device.id);
          latitude = body.position.latitude;
          longitude = body.position.longitude;
          speed = body.position.speed || 0;
          heading = body.position.course || 0;
          batteryLevel = body.position.attributes?.batteryLevel || null;
        } else {
          // Flat JSON format
          deviceId = body.deviceId || body.uniqueId || body.id;
          latitude = body.latitude || body.lat;
          longitude = body.longitude || body.lon;
          speed = body.speed || 0;
          heading = body.heading || body.course || body.bearing || 0;
          batteryLevel = body.batteryLevel || body.battery || null;
        }
      } catch {
        // If JSON parsing fails, fall back to URL parameters
      }
    }

    // 2. Fall back/extract parameters from URL Query Parameters
    const searchParams = request.nextUrl.searchParams;
    if (!deviceId) {
      deviceId = searchParams.get("deviceId") || searchParams.get("id") || "";
    }
    if (!latitude) {
      latitude = parseFloat(searchParams.get("lat") || searchParams.get("latitude") || "0");
    }
    if (!longitude) {
      longitude = parseFloat(searchParams.get("lon") || searchParams.get("longitude") || "0");
    }
    if (!speed) {
      speed = parseFloat(searchParams.get("speed") || "0");
    }
    if (!heading) {
      heading = parseFloat(searchParams.get("bearing") || searchParams.get("course") || searchParams.get("heading") || "0");
    }
    if (batteryLevel === null) {
      const battStr = searchParams.get("battery") || searchParams.get("batteryLevel");
      batteryLevel = battStr ? parseInt(battStr) : null;
    }

    if (!deviceId || !latitude || !longitude) {
      return NextResponse.json({ error: "Missing deviceId, latitude, or longitude" }, { status: 400 });
    }

    // 3. Find vehicle mapping by deviceId (IMEI)
    const { data: vehicle, error: fetchError } = await supabaseAdmin
      .from("vehicles")
      .select("id")
      .eq("device_id", deviceId)
      .eq("status", "Active")
      .maybeSingle();

    if (fetchError || !vehicle) {
      return NextResponse.json({ error: `Vehicle with device ID ${deviceId} not found or inactive` }, { status: 404 });
    }

    // 4. Insert location record
    const { error: insertError } = await supabaseAdmin
      .from("vehicle_locations")
      .insert({
        vehicle_id: vehicle.id,
        latitude,
        longitude,
        speed: speed * 1.852, // Convert knots to km/h (if from Traccar)
        heading,
        battery_level: batteryLevel,
      });

    if (insertError) throw insertError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
