import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/storefront/manage/inquiries
// List customer questions, quote inquiries, and backorder notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = supabaseAdmin
      .from("storefront_inquiries")
      .select(`
        *,
        products (
          id,
          name,
          sku,
          brand,
          selling_price
        )
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist") && !error.message.includes("schema cache")) {
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Storefront inquiries GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/storefront/manage/inquiries
// Update inquiry status (New -> Contacted -> Resolved)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("storefront_inquiries")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Storefront inquiries PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
