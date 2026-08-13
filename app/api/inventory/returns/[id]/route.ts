// app/api/inventory/returns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { return_type } = body;

    if (!return_type || !["Good", "Damage"].includes(return_type)) {
      return NextResponse.json({ error: "Invalid return_type" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_returns")
      .update({ return_type })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("PATCH /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch return record to reverse stock changes
    const { data: retRecord, error: fetchErr } = await supabaseAdmin
      .from("inventory_returns")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !retRecord) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const { product_id, location_id, quantity, return_type, business_id, return_number } = retRecord;
    const qty = Number(quantity || 0);

    // 2. Reverse Stock Adjustments
    if (product_id && qty > 0) {
      const isDamage = return_type !== "Good";

      // Reverse in location stock
      if (location_id) {
        const { data: locStock } = await supabaseAdmin
          .from("product_stocks")
          .select("id, quantity, damaged_quantity")
          .eq("product_id", product_id)
          .eq("location_id", location_id)
          .maybeSingle();

        if (locStock) {
          if (isDamage) {
            await supabaseAdmin
              .from("product_stocks")
              .update({
                damaged_quantity: Math.max(0, Number(locStock.damaged_quantity || 0) - qty),
                last_updated: new Date().toISOString(),
              })
              .eq("id", locStock.id);
          } else {
            await supabaseAdmin
              .from("product_stocks")
              .update({
                quantity: Math.max(0, Number(locStock.quantity || 0) - qty),
                last_updated: new Date().toISOString(),
              })
              .eq("id", locStock.id);
          }
        }
      }

      // Reverse in main product table
      const { data: mainProduct } = await supabaseAdmin
        .from("products")
        .select("id, name, stock_quantity, damaged_quantity")
        .eq("id", product_id)
        .maybeSingle();

      if (mainProduct) {
        if (isDamage) {
          await supabaseAdmin
            .from("products")
            .update({
              damaged_quantity: Math.max(0, Number(mainProduct.damaged_quantity || 0) - qty),
            })
            .eq("id", product_id);
        } else {
          await supabaseAdmin
            .from("products")
            .update({
              stock_quantity: Math.max(0, Number(mainProduct.stock_quantity || 0) - qty),
            })
            .eq("id", product_id);
        }

        // Log Reversal Transaction
        await supabaseAdmin.from("account_transactions").insert({
          transaction_type: "INVENTORY_RETURN_REVERSAL",
          description: `Reversed Return ${return_number || ""}: Subtracted ${qty} units (${return_type}) of ${mainProduct.name}`,
          amount: 0,
          transaction_date: new Date().toISOString(),
          business_id: business_id || null,
          metadata: {
            reversed_return_id: id,
            product_id,
            quantity: qty,
            type: return_type,
          },
        });
      }
    }

    // 3. Delete Return Record
    const { error: deleteErr } = await supabaseAdmin
      .from("inventory_returns")
      .delete()
      .eq("id", id);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({
      success: true,
      message: "Return deleted and stock reversed successfully",
    });
  } catch (error: any) {
    console.error("DELETE /api/inventory/returns/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
