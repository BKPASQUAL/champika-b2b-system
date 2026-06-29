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

    const { data, error } = await supabase
      .from("vehicle_locations")
      .select("latitude, longitude, speed, heading, updated_at")
      .eq("vehicle_id", id)
      .gte("updated_at", start)
      .lte("updated_at", end)
      .order("updated_at", { ascending: true })
      .range(0, 9999);

    if (error) throw error;

    let filteredData = data || [];
    // Downsample if we have too many coordinates to keep the map fast and light
    if (filteredData.length > 1000) {
      const step = Math.ceil(filteredData.length / 1000);
      filteredData = filteredData.filter((_, index) => index % step === 0);
    }

    return NextResponse.json(filteredData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
