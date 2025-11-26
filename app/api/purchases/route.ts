import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// Validation for Purchase Items
const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unitPrice: z.number(), // Gross Cost Price
  mrp: z.number(),
  sellingPrice: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  finalPrice: z.number(), // Net Cost Price
  total: z.number(),
});

// Validation for Purchase Header
const purchaseSchema = z.object({
  supplier_id: z.string(),
  invoice_number: z.string().optional().or(z.literal("")),
  purchase_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  total_amount: z.number(),
  items: z.array(itemSchema),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = purchaseSchema.parse(body);

    // 1. Generate Purchase ID (PO-XXXX)
    const { count } = await supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const purchaseId = `PO-${nextId}`;

    // 2. Insert Purchase Header
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        purchase_id: purchaseId,
        supplier_id: val.supplier_id,
        invoice_no: val.invoice_number,
        purchase_date: val.purchase_date,
        arrival_date: val.arrival_date || null,
        total_amount: val.total_amount,
        payment_status: "Unpaid",
        status: "Ordered",
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // 3. Prepare and Insert Purchase Items
    const itemsData = val.items.map((item) => ({
      purchase_id: purchase.id,
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_cost: item.finalPrice, // Net cost after discount
      mrp: item.mrp,
      selling_price: item.sellingPrice,
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
      total_cost: item.total,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(itemsData);

    if (itemsError) {
      console.error("Error inserting items:", itemsError);
      // In a real production app, you might want to delete the header here to rollback
      throw itemsError;
    }

    // 4. Update Inventory & Product Prices
    // This loop updates the stock and prices for every item purchased
    for (const item of val.items) {
      // A. Increment Stock (Qty + Free Qty)
      const totalQtyToAdd = item.quantity + item.freeQuantity;

      const { error: rpcError } = await supabaseAdmin.rpc("increment_stock", {
        p_id: item.productId,
        qty: totalQtyToAdd,
      });

      if (rpcError) {
        console.error(
          `Failed to update stock for product ${item.productId}:`,
          rpcError
        );
      }

      // B. Update Product Master Data (Cost, MRP, Selling Price)
      // We update the product with the latest prices from this purchase
      const { error: updateError } = await supabaseAdmin
        .from("products")
        .update({
          cost_price: item.finalPrice, // Update Cost Price to latest Net Cost
          mrp: item.mrp, // Update MRP
          selling_price: item.sellingPrice, // Update Selling Price
        })
        .eq("id", item.productId);

      if (updateError) {
        console.error(
          `Failed to update prices for product ${item.productId}`,
          updateError
        );
      }
    }

    return NextResponse.json(
      { message: "Purchase Order Created", id: purchase.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Purchase creation failed:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
