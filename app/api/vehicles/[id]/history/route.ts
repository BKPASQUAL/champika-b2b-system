// app/api/vehicles/[id]/history/route.ts
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json({ error: "Missing start or end query parameters" }, { status: 400 });
    }

    let data: any[] | null = null;
    let error: any = null;

    const query = supabase
      .from("vehicle_locations")
      .select("latitude, longitude, speed, heading, updated_at, ignition")
      .eq("vehicle_id", id)
      .gte("updated_at", start)
      .lte("updated_at", end)
      .order("updated_at", { ascending: true })
      .range(0, 9999);

    const firstRes = await query;
    data = firstRes.data;
    error = firstRes.error;

    // Fail-safe retry if ignition column is not defined yet in database
    if (error && error.code === "42703") {
      const retryQuery = supabase
        .from("vehicle_locations")
        .select("latitude, longitude, speed, heading, updated_at")
        .eq("vehicle_id", id)
        .gte("updated_at", start)
        .lte("updated_at", end)
        .order("updated_at", { ascending: true })
        .range(0, 9999);
      const res = await retryQuery;
      data = res.data;
      error = res.error;
    }

    if (error) throw error;

    const filteredData = data || [];

    return NextResponse.json(filteredData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
