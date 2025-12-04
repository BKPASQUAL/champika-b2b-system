// app/api/settings/categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

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
  category_id: z.string().nullable().optional(), // ✅ NEW: For linking models/specs to categories
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = schema.parse(body);

    const insertData: any = {
      name: val.name,
      type: val.type,
    };

    // Add parent_id if provided (for hierarchical relationships)
    if (val.parent_id) {
      insertData.parent_id = val.parent_id;
    }

    // ✅ Add category_id if provided (for models/specs)
    if (val.category_id) {
      insertData.category_id = val.category_id;
    }

    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert(insertData)
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
  const categoryId = searchParams.get("category_id");

  try {
    let query = supabaseAdmin.from("categories").select("*").order("name");

    if (type) {
      query = query.eq("type", type);
    }

    // ✅ Filter by category_id if provided
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
