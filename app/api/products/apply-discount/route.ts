import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const discountArray = z
  .array(z.number().min(0).max(100))
  .length(3)
  .default([0, 0, 0]);

const schema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
  sellingDiscounts: discountArray,
  costDiscounts: discountArray,
});

function applyChain(base: number, d1: number, d2: number, d3: number) {
  return Math.round(base * (1 - d1 / 100) * (1 - d2 / 100) * (1 - d3 / 100) * 100) / 100;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, sellingDiscounts, costDiscounts } = schema.parse(body);

    const { data: products, error: fetchError } = await supabaseAdmin
      .from("products")
      .select("id, selling_price, cost_price, mrp, price_history")
      .in("id", productIds);

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return NextResponse.json({ error: "No products found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const product of products) {
      const mrp: number = product.mrp ?? 0;
      if (mrp <= 0) continue;

      const newSelling = applyChain(mrp, sellingDiscounts[0], sellingDiscounts[1], sellingDiscounts[2]);
      const newCost = applyChain(mrp, costDiscounts[0], costDiscounts[1], costDiscounts[2]);

      const history: any[] = Array.isArray(product.price_history) ? product.price_history : [];
      history.push({
        date: now,
        costPrice: newCost,
        sellingPrice: newSelling,
        mrp: product.mrp,
      });

      const { error: updateError } = await supabaseAdmin
        .from("products")
        .update({
          selling_price: newSelling,
          cost_price: newCost,
          price_history: history,
          updated_at: now,
        })
        .eq("id", product.id);

      if (!updateError) updatedCount++;
    }

    return NextResponse.json({
      message: `Successfully updated prices for ${updatedCount} product${updatedCount !== 1 ? "s" : ""}`,
      updatedCount,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Discount apply failed" }, { status: 500 });
  }
}
