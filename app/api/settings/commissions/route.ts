import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation Schema
const ruleSchema = z.object({
  supplierId: z.string().min(1),
  supplierName: z.string().optional(),
  category: z.string().min(1),
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
      // Fail gracefully if table doesn't exist yet
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

    // Insert new rule
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

    // OPTIONAL: Apply this rule to existing products immediately
    // This updates the commission_value of products matching this supplier & category
    await supabaseAdmin
      .from("products")
      .update({
        commission_type: "percentage",
        commission_value: val.rate,
      })
      .eq("supplier_name", val.supplierName)
      .eq("category", val.category);

    return NextResponse.json(
      { message: "Rule created and applied", data },
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
