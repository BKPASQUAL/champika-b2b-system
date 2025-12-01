import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// UPDATED: Added "lorry" to the enum list
const schema = z.object({
  name: z.string().min(1),
  type: z.enum([
    "category",
    "brand",
    "model",
    "spec",
    "supplier",
    "route",
    "lorry",
  ]),
  parent_id: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = schema.parse(body);

    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert(val)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    let query = supabaseAdmin.from("categories").select("*").order("name");
    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
