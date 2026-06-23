import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    let query = supabaseAdmin
      .from("quotations")
      .select("id, quotation_no, date, valid_until, customer_name, customer_phone, status, grand_total, created_at")
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);
    if (search) query = query.ilike("customer_name", `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Generate quotation number: QUO-YYYYMMDD-NNN
    const { count } = await supabaseAdmin.from("quotations").select("*", { count: "exact", head: true });
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seq = String((count ?? 0) + 1).padStart(3, "0");
    const quotation_no = `QUO-${dateStr}-${seq}`;

    const { data, error } = await supabaseAdmin
      .from("quotations")
      .insert({
        quotation_no,
        date: body.date || new Date().toISOString().slice(0, 10),
        valid_until: body.valid_until || null,
        customer_name: body.customer_name || "",
        customer_phone: body.customer_phone || null,
        customer_address: body.customer_address || null,
        prepared_by: body.prepared_by || null,
        notes: body.notes || null,
        status: "Draft",
        items: body.items || [],
        sub_total: body.sub_total || 0,
        discount: body.discount || 0,
        grand_total: body.grand_total || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
