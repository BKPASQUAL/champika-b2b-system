// app/api/settings/commissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Updated Schema with subCategory
const ruleSchema = z.object({
  supplierId: z.string().min(1),
  supplierName: z.string().optional(),
  category: z.string().min(1),
  subCategory: z.string().nullable().optional(), // New field
  rate: z.number().min(0),
});

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
      subCategory: d.sub_category, // Return sub_category
      rate: d.rate,
    }));

    return NextResponse.json(mappedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = ruleSchema.parse(body);
    const subCategory = val.subCategory || null;

    // 1. CHECK FOR DUPLICATES (Specific Combination)
    let dupQuery = supabaseAdmin
      .from("commission_rules")
      .select("id")
      .eq("supplier_id", val.supplierId)
      .eq("category", val.category);

    if (subCategory) {
      dupQuery = dupQuery.eq("sub_category", subCategory);
    } else {
      dupQuery = dupQuery.is("sub_category", null);
    }

    const { data: existing } = await dupQuery.maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `A rule for this specific category/sub-category already exists.`,
        },
        { status: 409 }
      );
    }

    // 2. INSERT NEW RULE
    const { data, error } = await supabaseAdmin
      .from("commission_rules")
      .insert({
        supplier_id: val.supplierId,
        supplier_name: val.supplierName,
        category: val.category,
        sub_category: subCategory,
        rate: val.rate,
      })
      .select()
      .single();

    if (error) throw error;

    // 3. APPLY TO PRODUCTS (WITH PRIORITY LOGIC)

    if (val.category !== "ALL") {
      if (subCategory) {
        // --- PRIORITY 1: SUB-CATEGORY RULE ---
        // Just update the specific sub-category items.
        // This naturally overrides any broader category rule previously set.
        await supabaseAdmin
          .from("products")
          .update({
            commission_type: "percentage",
            commission_value: val.rate,
          })
          .eq("supplier_name", val.supplierName)
          .eq("category", val.category)
          .eq("sub_category", subCategory);
      } else {
        // --- PRIORITY 2: CATEGORY RULE ---
        // Update the category, BUT exclude items belonging to a sub-category
        // that already has its own specific rule.

        // A. Find which sub-categories have their own rules
        const { data: existingSubRules } = await supabaseAdmin
          .from("commission_rules")
          .select("sub_category")
          .eq("supplier_id", val.supplierId)
          .eq("category", val.category)
          .not("sub_category", "is", null);

        const protectedSubCats =
          existingSubRules?.map((r: any) => r.sub_category) || [];

        // B. Update products, excluding protected sub-categories
        let query = supabaseAdmin
          .from("products")
          .update({
            commission_type: "percentage",
            commission_value: val.rate,
          })
          .eq("supplier_name", val.supplierName)
          .eq("category", val.category);

        if (protectedSubCats.length > 0) {
          // Syntax for "NOT IN ('A', 'B')"
          const filterString = `(${protectedSubCats
            .map((c: string) => `"${c}"`)
            .join(",")})`;
          query = query.filter("sub_category", "not.in", filterString);
        }

        await query;
      }
    } else {
      // --- PRIORITY 3: GLOBAL "ALL" RULE ---
      // Update everything for supplier, BUT exclude Categories that have rules.

      const { data: specificRules } = await supabaseAdmin
        .from("commission_rules")
        .select("category")
        .eq("supplier_id", val.supplierId)
        .neq("category", "ALL");

      // Unique list of categories to protect
      const protectedCategories = Array.from(
        new Set(specificRules?.map((r: any) => r.category) || [])
      );

      let query = supabaseAdmin
        .from("products")
        .update({
          commission_type: "percentage",
          commission_value: val.rate,
        })
        .eq("supplier_name", val.supplierName);

      if (protectedCategories.length > 0) {
        const filterString = `(${protectedCategories
          .map((c: string) => `"${c}"`)
          .join(",")})`;
        query = query.filter("category", "not.in", filterString);
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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  try {
    // 1. Get the rule to delete
    const { data: deletedRules, error: fetchError } = await supabaseAdmin
      .from("commission_rules")
      .delete()
      .eq("id", id)
      .select();

    if (fetchError) throw fetchError;
    if (!deletedRules || deletedRules.length === 0)
      return NextResponse.json({ message: "Rule not found" });

    const rule = deletedRules[0];

    // 2. Calculate Fallback Rate
    // If we delete a Sub-Category rule -> Fallback to Category Rule -> Fallback to Global Rule -> 0
    let fallbackRate = 0;

    if (rule.sub_category) {
      // Look for Category Rule
      const { data: catRule } = await supabaseAdmin
        .from("commission_rules")
        .select("rate")
        .eq("supplier_id", rule.supplier_id)
        .eq("category", rule.category)
        .is("sub_category", null)
        .maybeSingle();

      if (catRule) fallbackRate = catRule.rate;
      else {
        // Look for Global Rule
        const { data: globalRule } = await supabaseAdmin
          .from("commission_rules")
          .select("rate")
          .eq("supplier_id", rule.supplier_id)
          .eq("category", "ALL")
          .maybeSingle();
        if (globalRule) fallbackRate = globalRule.rate;
      }
    } else if (rule.category !== "ALL") {
      // Look for Global Rule
      const { data: globalRule } = await supabaseAdmin
        .from("commission_rules")
        .select("rate")
        .eq("supplier_id", rule.supplier_id)
        .eq("category", "ALL")
        .maybeSingle();
      if (globalRule) fallbackRate = globalRule.rate;
    }

    // 3. Update Products to Fallback Rate
    let query = supabaseAdmin
      .from("products")
      .update({ commission_value: fallbackRate })
      .eq("supplier_name", rule.supplier_name);

    if (rule.category !== "ALL") {
      query = query.eq("category", rule.category);
    }
    if (rule.sub_category) {
      query = query.eq("sub_category", rule.sub_category);
    }

    await query;

    return NextResponse.json({ message: "Rule deleted and products updated" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
