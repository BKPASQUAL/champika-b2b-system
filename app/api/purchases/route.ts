import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unitPrice: z.number(), // This is the BILL Price
  mrp: z.number(),
  sellingPrice: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  finalPrice: z.number(),
  total: z.number(), // Line Total
});

const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  business_id: z.string().min(1, "Business is required"),
  // ✅ UPDATE: Invoice Number is now REQUIRED
  invoice_number: z.string().min(1, "Invoice Number is required"),
  purchase_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  total_amount: z.number(),
  extra_discount: z.number().optional().default(0),
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
      extraDiscount: p.extra_discount || 0,
      paidAmount: p.paid_amount,
      itemsCount: 0,
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

    // ✅ UPDATE: Check for Duplicate Invoice Number for this Supplier
    const { data: existingInvoice } = await supabaseAdmin
      .from("purchases")
      .select("id")
      .eq("supplier_id", val.supplier_id)
      .eq("invoice_no", val.invoice_number)
      .maybeSingle();

    if (existingInvoice) {
      return NextResponse.json(
        { error: "This Invoice Number already exists for this supplier." },
        { status: 409 } // 409 Conflict
      );
    }

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
        extra_discount: val.extra_discount,
        payment_status: "Unpaid",
        status: "Ordered",
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // --- Calculate Distribution of Extra Discount ---
    const subtotal = val.items.reduce((sum, item) => sum + item.total, 0);
    const extraDiscount = val.extra_discount || 0;

    // 4. Prepare Items Data
    const itemsData = val.items.map((item) => {
      const totalQty = item.quantity + item.freeQuantity;

      // Calculate discount share for this item
      const discountShare =
        subtotal > 0 ? (item.total / subtotal) * extraDiscount : 0;

      // Calculate Net Total for this item (Line Total - Share)
      const netItemTotal = item.total - discountShare;

      // Calculate Actual Unit Cost
      const actualCost = netItemTotal / totalQty;

      return {
        purchase_id: purchase.id,
        product_id: item.productId,
        quantity: item.quantity,
        free_quantity: item.freeQuantity,
        unit_cost: item.unitPrice, // Original Billed Price
        actual_unit_cost: actualCost, // ✅ Calculated Price (Reduced by Extra Discount)
        mrp: item.mrp,
        selling_price: item.sellingPrice,
        discount_percent: item.discountPercent,
        discount_amount: item.discountAmount,
        total_cost: item.total, // Line total before extra discount
      };
    });

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(itemsData);

    if (itemsError) {
      await supabaseAdmin.from("purchases").delete().eq("id", purchase.id);
      throw itemsError;
    }

    // 5. Update Stock & Costs in Product Table
    for (let i = 0; i < val.items.length; i++) {
      const item = val.items[i];
      const processedItem = itemsData[i];

      const totalQty = item.quantity + item.freeQuantity;

      const { data: currentProduct } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      await supabaseAdmin
        .from("products")
        .update({
          stock_quantity: (currentProduct?.stock_quantity || 0) + totalQty,
          cost_price: item.unitPrice,
          actual_cost_price: processedItem.actual_unit_cost,
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
