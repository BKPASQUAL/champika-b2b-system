// app/api/vehicles/location/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

function writeGpsLog(
  method: string,
  pathname: string,
  body: any,
  query: any,
  responseStatus: number,
  responseBody: any
) {
  try {
    const logFilePath = path.join(process.cwd(), "public", "gps_logs.txt");
    const timestamp = new Date().toISOString();
    const logEntry = `
[${timestamp}] ${method} ${pathname}
Query Params: ${JSON.stringify(query)}
Body: ${JSON.stringify(body)}
Response: ${responseStatus} - ${JSON.stringify(responseBody)}
--------------------------------------------------
`;
    // If log file exceeds 5MB, overwrite it to prevent disk space issues
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > 5 * 1024 * 1024) {
        fs.writeFileSync(logFilePath, logEntry);
        return;
      }
    }
    fs.appendFileSync(logFilePath, logEntry);
  } catch (error) {
    console.error("Failed to write GPS log to file:", error);
  }
}

async function handleRequest(request: NextRequest) {
  const method = request.method;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  let reqBody: any = null;

  const returnResponse = (status: number, data: any) => {
    writeGpsLog(method, request.nextUrl.pathname, reqBody, searchParams, status, data);
    return NextResponse.json(data, { status });
  };

  try {
    let deviceId = "";
    let latitude = 0;
    let longitude = 0;
    let speed = 0;
    let heading = 0;
    let batteryLevel: number | null = null;
    let timestamp: string | null = null;

    console.log(`[GPS Webhook] Incoming request method: ${method}`);

    // 1. Try parsing JSON body if it's a POST request
    if (method === "POST") {
      try {
        reqBody = await request.clone().json();
        console.log("[GPS Webhook] Parsed JSON Body:", JSON.stringify(reqBody));
        
        // Handle standard Traccar JSON format (nested structure)
        if (reqBody.device && reqBody.position) {
          deviceId = reqBody.device.uniqueId || String(reqBody.device.id);
          latitude = reqBody.position.latitude;
          longitude = reqBody.position.longitude;
          speed = reqBody.position.speed || 0;
          heading = reqBody.position.course || 0;
          batteryLevel = reqBody.position.attributes?.batteryLevel || null;
          timestamp = reqBody.position.deviceTime || reqBody.position.fixTime || reqBody.position.serverTime || null;
        } else {
          // Flat JSON format
          deviceId = reqBody.deviceId || reqBody.uniqueId || reqBody.id;
          latitude = reqBody.latitude || reqBody.lat;
          longitude = reqBody.longitude || reqBody.lon;
          speed = reqBody.speed || 0;
          heading = reqBody.heading || reqBody.course || reqBody.bearing || 0;
          batteryLevel = reqBody.batteryLevel || reqBody.battery || null;
          timestamp = reqBody.timestamp || reqBody.time || reqBody.deviceTime || reqBody.fixTime || null;
        }
      } catch (e: any) {
        console.log("[GPS Webhook] JSON parse fallback. Info:", e.message);
      }
    }

    // 2. Fall back/extract parameters from URL Query Parameters
    if (!deviceId) {
      deviceId = searchParams.deviceId || searchParams.id || "";
    }
    if (!latitude) {
      latitude = parseFloat(searchParams.lat || searchParams.latitude || "0");
    }
    if (!longitude) {
      longitude = parseFloat(searchParams.lon || searchParams.longitude || "0");
    }
    if (!speed) {
      speed = parseFloat(searchParams.speed || "0");
    }
    if (!heading) {
      heading = parseFloat(searchParams.bearing || searchParams.course || searchParams.heading || "0");
    }
    if (batteryLevel === null) {
      const battStr = searchParams.battery || searchParams.batteryLevel;
      batteryLevel = battStr ? parseInt(battStr) : null;
    }
    if (!timestamp) {
      timestamp = searchParams.timestamp || searchParams.time || searchParams.deviceTime || searchParams.fixTime || null;
    }

    console.log(`[GPS Webhook] Resolved Values -> IMEI: "${deviceId}", Lat: ${latitude}, Lng: ${longitude}, Speed: ${speed}, Heading: ${heading}, Battery: ${batteryLevel}, Timestamp: ${timestamp}`);

    if (!deviceId || !latitude || !longitude) {
      console.warn("[GPS Webhook] Rejected: Missing required variables (deviceId, latitude, or longitude).");
      return returnResponse(400, { error: "Missing deviceId, latitude, or longitude" });
    }

    // 3. Find vehicle mapping by deviceId (IMEI)
    console.log(`[GPS Webhook] Querying Supabase for vehicle mapped to IMEI: "${deviceId}"`);
    const { data: vehicle, error: fetchError } = await supabaseAdmin
      .from("vehicles")
      .select("id, vehicle_number")
      .eq("device_id", deviceId)
      .eq("status", "Active")
      .maybeSingle();

    if (fetchError) {
      console.error("[GPS Webhook] Database fetch error:", fetchError.message);
      throw fetchError;
    }

    if (!vehicle) {
      console.warn(`[GPS Webhook] Mismatch: No active vehicle found in DB for IMEI: "${deviceId}"`);
      return returnResponse(404, { error: `Vehicle with device ID ${deviceId} not found or inactive` });
    }

    console.log(`[GPS Webhook] Mapped successfully to Vehicle: "${vehicle.vehicle_number}" (UUID: ${vehicle.id})`);

    // Parse and validate timestamp
    let parsedUpdatedAt: string | undefined = undefined;
    if (timestamp) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) {
        parsedUpdatedAt = d.toISOString();
      }
    }

    // 4. Insert location record
    console.log(`[GPS Webhook] Writing coordinates to vehicle_locations table...`);
    const insertPayload: any = {
      vehicle_id: vehicle.id,
      latitude,
      longitude,
      speed: speed * 1.852, // Convert knots to km/h (if from Traccar)
      heading,
      battery_level: batteryLevel,
    };
    if (parsedUpdatedAt) {
      insertPayload.updated_at = parsedUpdatedAt;
    }

    const { error: insertError } = await supabaseAdmin
      .from("vehicle_locations")
      .insert(insertPayload);

    if (insertError) {
      console.error("[GPS Webhook] Database insert error:", insertError.message);
      throw insertError;
    }

    console.log(`[GPS Webhook] Successfully saved location coordinate log for vehicle ${vehicle.vehicle_number}!`);
    return returnResponse(200, { success: true });
  } catch (error: any) {
    console.error("[GPS Webhook] Fatal webhook processing error:", error);
    return returnResponse(500, { error: error.message });
  }
}
