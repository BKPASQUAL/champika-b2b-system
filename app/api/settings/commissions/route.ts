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

// POST: Add a new rule and update relevant products
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = ruleSchema.parse(body);

    // 1. CHECK FOR DUPLICATES
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
        { status: 409 }
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

    // 3. UPDATE EXISTING PRODUCTS
    if (val.category !== "ALL") {
      // --- Case A: Adding a Specific Category Rule ---
      // Update only products in this specific category
      await supabaseAdmin
        .from("products")
        .update({
          commission_type: "percentage",
          commission_value: val.rate,
        })
        .eq("supplier_name", val.supplierName)
        .eq("category", val.category);
    } else {
      // --- Case B: Adding an "All Categories" (Global) Rule ---
      // We must update all products for this supplier,
      // EXCEPT those that belong to a category that has its own specific rule.

      // 1. Find all other specific rules for this supplier to exclude them
      const { data: specificRules } = await supabaseAdmin
        .from("commission_rules")
        .select("category")
        .eq("supplier_id", val.supplierId)
        .neq("category", "ALL"); // Don't include the rule we just made

      const excludedCategories =
        specificRules?.map((r: any) => r.category) || [];

      // 2. Prepare update query
      let query = supabaseAdmin
        .from("products")
        .update({
          commission_type: "percentage",
          commission_value: val.rate,
        })
        .eq("supplier_name", val.supplierName);

      // 3. Apply exclusion filter if there are specific categories to protect
      if (excludedCategories.length > 0) {
        // Format for PostgREST: ("Cat1","Cat2")
        const formattedList = `(${excludedCategories
          .map((c: string) => `"${c}"`)
          .join(",")})`;
        query = query.filter("category", "not.in", formattedList);
      }

      await query;
    }

    return NextResponse.json(
      { message: "Rule created and products updated", data },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Remove a rule and reset/recalculate product commissions
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    // 1. Fetch the rule first so we know what to update
    const { data: deletedRules, error: fetchError } = await supabaseAdmin
      .from("commission_rules")
      .delete()
      .eq("id", id)
      .select();

    if (fetchError) throw fetchError;
    if (!deletedRules || deletedRules.length === 0) {
      return NextResponse.json({ message: "Rule not found" });
    }

    const deletedRule = deletedRules[0];
    const { supplier_name, category, supplier_id } = deletedRule;

    // 2. Logic to update products
    if (category !== "ALL") {
      // --- Case A: Deleting a Specific Category Rule ---

      // Check if there is a fallback "ALL" rule for this supplier
      const { data: allRule } = await supabaseAdmin
        .from("commission_rules")
        .select("rate")
        .eq("supplier_id", supplier_id)
        .eq("category", "ALL")
        .maybeSingle();

      const newRate = allRule ? allRule.rate : 0;

      // Update products in this specific category to the fallback rate (or 0)
      await supabaseAdmin
        .from("products")
        .update({ commission_value: newRate })
        .eq("supplier_name", supplier_name)
        .eq("category", category);
    } else {
      // --- Case B: Deleting the "ALL" (Default) Rule ---

      // Reset all products for this supplier to 0,
      // EXCEPT those that have a specific rule defined.

      const { data: remainingRules } = await supabaseAdmin
        .from("commission_rules")
        .select("category")
        .eq("supplier_id", supplier_id);

      const protectedCategories =
        remainingRules?.map((r: any) => r.category) || [];

      let query = supabaseAdmin
        .from("products")
        .update({ commission_value: 0 })
        .eq("supplier_name", supplier_name);

      if (protectedCategories.length > 0) {
        const formattedList = `(${protectedCategories
          .map((c: string) => `"${c}"`)
          .join(",")})`;
        query = query.filter("category", "not.in", formattedList);
      }

      await query;
    }

    return NextResponse.json({ message: "Rule deleted and products updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
