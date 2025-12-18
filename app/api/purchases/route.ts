// app/api/purchases/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unitPrice: z.number(), // This is the BILL Price (e.g., 1000)
  mrp: z.number(),
  sellingPrice: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  finalPrice: z.number(),
  total: z.number(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  business_id: z.string().min(1, "Business is required"),
  invoice_number: z.string().optional().or(z.literal("")),
  purchase_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  total_amount: z.number(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

// --- GET: Fetch All Purchases (With Filtering) ---
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");

    let query = supabaseAdmin
      .from("purchases")
      .select(
        `
        *,
        suppliers ( name, contact_person ),
        businesses ( name )
      `
      )
      .order("created_at", { ascending: false });

    if (businessId) {
      query = query.eq("business_id", businessId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const purchases = data.map((p: any) => ({
      id: p.id,
      purchaseId: p.purchase_id,
      supplierId: p.supplier_id,
      supplierName: p.suppliers?.name || "Unknown",
      businessId: p.business_id,
      businessName: p.businesses?.name || "N/A",
      invoiceNo: p.invoice_no,
      purchaseDate: p.purchase_date,
      arrivalDate: p.arrival_date,
      status: p.status,
      paymentStatus: p.payment_status,
      totalAmount: p.total_amount,
      paidAmount: p.paid_amount,
      itemsCount: 0, // You can populate this if needed
    }));

    return NextResponse.json(purchases);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Create New Purchase ---
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = purchaseSchema.parse(body);

    // 1. Find Global Main Warehouse
    let { data: location } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    if (!location) {
      const { data: newLocation, error: locError } = await supabaseAdmin
        .from("locations")
        .insert({ name: "Main Warehouse", business_id: null })
        .select("id")
        .single();
      if (locError) throw new Error("Could not create Main Warehouse");
      location = newLocation;
    }

    // 2. Generate Purchase ID
    const { count } = await supabaseAdmin
      .from("purchases")
      .select("*", { count: "exact", head: true });

    const nextId = (count || 0) + 1001;
    const purchaseId = `PO-${nextId}`;

    // 3. Insert Purchase
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        purchase_id: purchaseId,
        supplier_id: val.supplier_id,
        business_id: val.business_id,
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

    // 4. Prepare Items Data (Calculate Costs Here)
    const itemsData = val.items.map((item) => {
      const totalQty = item.quantity + item.freeQuantity;

      // FORMULA: Actual Cost = Total Price / (Qty + Free Qty)
      const actualCost = item.total / totalQty;

      return {
        purchase_id: purchase.id,
        product_id: item.productId,
        quantity: item.quantity,
        free_quantity: item.freeQuantity,

        // --- SAVING BOTH COSTS ---
        unit_cost: item.unitPrice, // 1. Bill Price (e.g. 1000)
        actual_unit_cost: actualCost, // 2. Actual Price (e.g. 833.33) [Requires new DB column]
        // -------------------------

        mrp: item.mrp,
        selling_price: item.sellingPrice,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
        total_cost: item.total,
      };
    });

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(itemsData);

    if (itemsError) {
      await supabaseAdmin.from("purchases").delete().eq("id", purchase.id);
      throw itemsError;
    }

    // 5. Update Stock & Master Cost Price
    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;
      const actualCost = item.total / totalQty; // Recalculate or grab from map above

      // Update Product Global Values
      const { data: currentProduct } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      await supabaseAdmin
        .from("products")
        .update({
          stock_quantity: (currentProduct?.stock_quantity || 0) + totalQty,

          // We update the master cost_price to the ACTUAL cost
          // This ensures your profit reports use the 833.33 figure
          cost_price: actualCost,

          mrp: item.mrp,
          selling_price: item.sellingPrice,
        })
        .eq("id", item.productId);

      // Update Location Stock
      const { data: currentStock } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("product_id", item.productId)
        .eq("location_id", location!.id)
        .single();

      if (currentStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Number(currentStock.quantity) + totalQty,
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", item.productId)
          .eq("location_id", location!.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id: item.productId,
          location_id: location!.id,
          quantity: totalQty,
        });
      }
    }

    return NextResponse.json(
      { message: "Purchase Order Created", id: purchase.id },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
