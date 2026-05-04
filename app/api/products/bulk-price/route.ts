import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const schema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        mrp: z.number().min(0),
        costPrice: z.number().min(0),
        sellingPrice: z.number().min(0),
      }),
    )
    .min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = schema.parse(body);

    // Validate selling > cost for all before touching DB
    for (const u of updates) {
      if (u.sellingPrice <= u.costPrice) {
        return NextResponse.json(
          { error: `Selling price must be greater than cost price (product id: ${u.id})` },
          { status: 400 },
        );
      }
    }

    const ids = updates.map((u) => u.id);
    const { data: products, error: fetchError } = await supabaseAdmin
      .from("products")
      .select("id, mrp, selling_price, cost_price, price_history")
      .in("id", ids);

    if (fetchError) throw fetchError;

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const update of updates) {
      const current = products?.find((p) => p.id === update.id);
      if (!current) continue;

      const currentCost = Number(current.cost_price);
      const currentSelling = Number(current.selling_price);
      const currentMrp = Number(current.mrp);

      const isPriceChanged =
        update.costPrice !== currentCost ||
        update.sellingPrice !== currentSelling ||
        update.mrp !== currentMrp;

      const dbUpdates: Record<string, unknown> = {
        mrp: update.mrp,
        selling_price: update.sellingPrice,
        cost_price: update.costPrice,
        actual_cost_price: update.costPrice,
        updated_at: now,
      };

      if (isPriceChanged) {
        const history = Array.isArray(current.price_history)
          ? current.price_history
          : [];
        dbUpdates.price_history = [
          {
            date: now,
            costPrice: currentCost,
            sellingPrice: currentSelling,
            mrp: currentMrp,
            source: "bulk",
          },
          ...history,
        ];
      }

      const { error } = await supabaseAdmin
        .from("products")
        .update(dbUpdates)
        .eq("id", update.id);

      if (!error) updatedCount++;
    }

    return NextResponse.json({
      message: `Updated ${updatedCount} product${updatedCount !== 1 ? "s" : ""}`,
      updatedCount,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 },
      );
    }
    const msg = error instanceof Error ? error.message : "Bulk price update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
