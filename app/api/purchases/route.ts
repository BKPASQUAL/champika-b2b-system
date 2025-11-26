import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unitPrice: z.number(), // Gross Cost Price
  mrp: z.number(),
  sellingPrice: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  finalPrice: z.number(), // Net Unit Cost
  total: z.number(),
});

const purchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  invoice_number: z.string().optional().or(z.literal("")),
  purchase_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  total_amount: z.number(),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

// --- GET: Fetch All Purchases ---
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("purchases")
      .select(
        `
        *,
        suppliers (
          name,
          contact_person
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Map to frontend format
    const purchases = data.map((p) => ({
      id: p.id,
      purchaseId: p.purchase_id,
      supplierId: p.supplier_id,
      supplierName: p.suppliers?.name || "Unknown",
      invoiceNo: p.invoice_no,
      purchaseDate: p.purchase_date,
      arrivalDate: p.arrival_date,
      status: p.status,
      paymentStatus: p.payment_status,
      totalAmount: p.total_amount,
      paidAmount: p.paid_amount,
      // We usually don't fetch full items list for the main table to save bandwidth,
      // but you can add a separate endpoint for fetching details if needed.
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

    // 1. Generate Purchase ID (PO-XXXX)
    // Note: In high concurrency, use a database sequence or function instead.
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

    // 3. Insert Purchase Items
    const itemsData = val.items.map((item) => ({
      purchase_id: purchase.id,
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_cost: item.unitPrice, // Gross Cost
      mrp: item.mrp,
      selling_price: item.sellingPrice,
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
      total_cost: item.total, // Net Total
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("purchase_items")
      .insert(itemsData);

    if (itemsError) {
      // Rollback: Delete the header if items fail (basic transaction simulation)
      await supabaseAdmin.from("purchases").delete().eq("id", purchase.id);
      throw itemsError;
    }

    // 4. Update Product Inventory & Prices
    // This ensures your product catalog always reflects the latest cost/price and stock
    for (const item of val.items) {
      // A. Get current product data to increment stock safely
      const { data: currentProduct } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      const currentStock = currentProduct?.stock_quantity || 0;
      const newStock = currentStock + item.quantity + item.freeQuantity;

      // B. Update Product
      await supabaseAdmin
        .from("products")
        .update({
          stock_quantity: newStock,
          cost_price: item.finalPrice, // Update Cost to latest Net Cost
          mrp: item.mrp, // Update MRP
          selling_price: item.sellingPrice, // Update Selling Price
        })
        .eq("id", item.productId);
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
