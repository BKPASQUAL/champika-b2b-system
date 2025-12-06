// app/api/settings/commissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const ruleSchema = z.object({
  supplierId: z.string().min(1),
  supplierName: z.string().optional(),
  category: z.string().min(1), // Can be "ALL" or a specific category name
  rate: z.number().min(0),
});

// GET: Fetch all commission rules
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("commission_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "42P01") return NextResponse.json([]);
      throw error;
    }

    const mappedData = data.map((d: any) => ({
      id: d.id,
      supplierId: d.supplier_id,
      supplierName: d.supplier_name || "Unknown",
      category: d.category,
      rate: d.rate,
    }));

    return NextResponse.json(mappedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Add a new rule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = ruleSchema.parse(body);

    // 1. CHECK FOR DUPLICATES
    // Check if a rule for this Supplier + Category already exists
    const { data: existing } = await supabaseAdmin
      .from("commission_rules")
      .select("id")
      .eq("supplier_id", val.supplierId)
      .eq("category", val.category)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error:
            val.category === "ALL"
              ? `A default 'All Categories' rule for this supplier already exists.`
              : `A rule for this Supplier and Category ('${val.category}') already exists.`,
        },
        { status: 409 } // 409 Conflict status code
      );
    }

    // 2. Insert new rule
    const { data, error } = await supabaseAdmin
      .from("commission_rules")
      .insert({
        supplier_id: val.supplierId,
        supplier_name: val.supplierName,
        category: val.category,
        rate: val.rate,
      })
      .select()
      .single();

    if (error) throw error;

    // 3. OPTIONAL: Update existing products
    // Only update specific products if it's NOT the "ALL" rule (to be safe)
    if (val.category !== "ALL") {
      await supabaseAdmin
        .from("products")
        .update({
          commission_type: "percentage",
          commission_value: val.rate,
        })
        .eq("supplier_name", val.supplierName)
        .eq("category", val.category);
    }

    return NextResponse.json(
      { message: "Rule created", data },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a rule
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin
      .from("commission_rules")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ message: "Rule deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
