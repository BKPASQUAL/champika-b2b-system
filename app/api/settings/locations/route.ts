import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  business_id: z.string().nullable().optional(), // Nullable for Main Warehouse
  is_main: z.boolean().optional(), // Flag from UI
});

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");

    let query = supabaseAdmin
      .from("locations")
      .select(
        `
        *,
        businesses ( name )
      `
      )
      .order("created_at", { ascending: false });

    // Filter: If businessId is provided, show that business's locations OR Main Warehouse (null)
    if (businessId) {
      query = query.or(`business_id.eq.${businessId},business_id.is.null`);
    }

    const { data, error } = await query;

    if (error) throw error;

    const locations = data.map((loc: any) => ({
      ...loc,
      businessName: loc.businesses?.name || "Global (Main Warehouse)",
      isMain: loc.business_id === null, // Helper flag
    }));

    return NextResponse.json(locations);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = schema.parse(body);

    // LOGIC: Main Warehouse vs Business Location
    if (val.is_main) {
      // 1. Check if Main Warehouse already exists
      const { data: existing } = await supabaseAdmin
        .from("locations")
        .select("id")
        .is("business_id", null)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          {
            error:
              "A Main Warehouse already exists. You cannot create another.",
          },
          { status: 400 }
        );
      }

      // 2. Create Main Warehouse (business_id = null)
      const { data, error } = await supabaseAdmin
        .from("locations")
        .insert({ name: val.name, business_id: null })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    } else {
      // 3. Create Business Location
      if (!val.business_id) {
        return NextResponse.json(
          { error: "Please select a business for this location." },
          { status: 400 }
        );
      }

      const { data, error } = await supabaseAdmin
        .from("locations")
        .insert({ name: val.name, business_id: val.business_id })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    // Optional: Prevent deleting Main Warehouse if it has stock
    const { error } = await supabaseAdmin
      .from("locations")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
