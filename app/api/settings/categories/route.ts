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

    // 1. Check for existing item with same name, type AND parent
    let checkQuery = supabaseAdmin
      .from("categories")
      .select("id")
      .eq("name", val.name)
      .eq("type", val.type);

    if (val.parent_id) {
      checkQuery = checkQuery.eq("parent_id", val.parent_id);
    } else {
      checkQuery = checkQuery.is("parent_id", null);
    }

    if (val.category_id) {
      checkQuery = checkQuery.eq("category_id", val.category_id);
    } else {
      checkQuery = checkQuery.is("category_id", null);
    }

    const { data: existing } = await checkQuery.single();

    if (existing) {
      return NextResponse.json(
        { error: `A ${val.type} with this name already exists in this group.` },
        { status: 409 }
      );
    }

    // 2. Proceed with Insert
    const insertData: any = {
      name: val.name,
      type: val.type,
    };

    if (val.parent_id) insertData.parent_id = val.parent_id;
    if (val.category_id) insertData.category_id = val.category_id;

    const { data, error } = await supabaseAdmin
      .from("categories")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    // Handle unique constraint violation gracefully if SQL fix wasn't applied
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "This item already exists." },
        { status: 409 }
      );
    }
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
