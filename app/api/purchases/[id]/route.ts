import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unitPrice: z.number(),
  mrp: z.number(),
  sellingPrice: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  finalPrice: z.number(),
  total: z.number(),
});

const updatePurchaseSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  invoice_number: z.string().min(1, "Invoice Number is required"),
  purchase_date: z.string(),
  arrival_date: z.string().optional().or(z.literal("")),
  total_amount: z.number(),
  extra_discount: z.number().optional().default(0),
  items: z.array(itemSchema).min(1, "At least one item is required"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: purchase, error } = await supabaseAdmin
      .from("purchases")
      .select(
        `
        *,
        supplier:suppliers ( name, contact_person, phone, email, address ),
        business:businesses ( name ),
        items:purchase_items (
          id,
          product_id,
          quantity,
          free_quantity,
          unit_cost,
          mrp,
          selling_price,
          discount_percent,
          discount_amount,
          total_cost,
          product:products ( name, sku, unit_of_measure )
        ),
        payments:supplier_payments (
          id,
          payment_number,
          amount,
          payment_date,
          payment_method,
          cheque_number,
          cheque_date,
          cheque_status,
          notes,
          account:bank_accounts ( account_name )
        )
      `
      )
      .eq("id", id)
      .order("payment_date", { referencedTable: "supplier_payments", ascending: true })
      .single();

    if (error) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    const formattedData = {
      id: purchase.id,
      purchaseId: purchase.purchase_id,
      supplierId: purchase.supplier_id,
      invoiceNo: purchase.invoice_no || "-",
      purchaseDate: purchase.purchase_date,
      arrivalDate: purchase.arrival_date,
      status: purchase.status,
      paymentStatus: purchase.payment_status,
      totalAmount: purchase.total_amount,
      extraDiscount: purchase.extra_discount || 0,
      paidAmount: purchase.paid_amount || 0,

      supplier: {
        name: purchase.supplier?.name || "Unknown",
        contactPerson: purchase.supplier?.contact_person,
        phone: purchase.supplier?.phone,
        email: purchase.supplier?.email,
        address: purchase.supplier?.address,
      },

      business: {
        name: purchase.business?.name || "N/A",
      },

      items: purchase.items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product?.name || "Unknown Product",
        sku: item.product?.sku || "-",
        quantity: item.quantity,
        freeQuantity: item.free_quantity,
        unit: item.product?.unit_of_measure || "Unit",
        unitCost: item.unit_cost,
        mrp: item.mrp || 0,
        sellingPrice: item.selling_price || 0,
        discountPercent: item.discount_percent || 0,
        discount: item.discount_amount,
        totalCost: item.total_cost,
      })),

      payments: (purchase.payments || []).map((p: any) => ({
        id: p.id,
        paymentNumber: p.payment_number,
        amount: p.amount,
        paymentDate: p.payment_date,
        paymentMethod: p.payment_method,
        chequeNumber: p.cheque_number,
        chequeDate: p.cheque_date,
        chequeStatus: p.cheque_status,
        notes: p.notes,
        accountName: p.account?.account_name ?? null,
      })),
    };

    return NextResponse.json(formattedData);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = updatePurchaseSchema.parse(body);

    // 1. Get existing purchase + old items
    const { data: existingPurchase, error: fetchError } = await supabaseAdmin
      .from("purchases")
      .select("*, items:purchase_items(id, product_id, quantity, free_quantity)")
      .eq("id", id)
      .single();

    if (fetchError || !existingPurchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // 2. Check for duplicate invoice number if it changed
    if (val.invoice_number !== existingPurchase.invoice_no) {
      const { data: existingInvoice } = await supabaseAdmin
        .from("purchases")
        .select("id")
        .eq("supplier_id", val.supplier_id)
        .eq("invoice_no", val.invoice_number)
        .neq("id", id)
        .maybeSingle();

      if (existingInvoice) {
        return NextResponse.json(
          { error: "This Invoice Number already exists for this supplier." },
          { status: 409 }
        );
      }
    }

    // 3. Find Main Warehouse
    const { data: location } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    if (!location) {
      return NextResponse.json({ error: "Main Warehouse not found" }, { status: 400 });
    }

    // 4. Reverse stock from old items
    const oldItems: any[] = existingPurchase.items || [];
    for (const oldItem of oldItems) {
      const oldTotalQty = (oldItem.quantity || 0) + (oldItem.free_quantity || 0);

      const { data: currentProduct } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", oldItem.product_id)
        .single();

      if (currentProduct) {
        await supabaseAdmin
          .from("products")
          .update({ stock_quantity: Math.max(0, (currentProduct.stock_quantity || 0) - oldTotalQty) })
          .eq("id", oldItem.product_id);
      }

      const { data: currentStock } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("product_id", oldItem.product_id)
        .eq("location_id", location.id)
        .maybeSingle();

      if (currentStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Math.max(0, Number(currentStock.quantity) - oldTotalQty),
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", oldItem.product_id)
          .eq("location_id", location.id);
      }
    }

    // 5. Delete old cost layers and items
    await supabaseAdmin.from("product_cost_layers").delete().eq("purchase_id", id);
    await supabaseAdmin.from("purchase_items").delete().eq("purchase_id", id);

    // 6. Build new items data with extra discount distribution
    const subtotal = val.items.reduce((sum, item) => sum + item.total, 0);
    const extraDiscount = val.extra_discount || 0;

    const itemsData = val.items.map((item) => {
      const totalQty = item.quantity + item.freeQuantity;
      const discountShare = subtotal > 0 ? (item.total / subtotal) * extraDiscount : 0;
      const netItemTotal = item.total - discountShare;
      const actualCost = totalQty > 0 ? netItemTotal / totalQty : item.unitPrice;

      return {
        purchase_id: id,
        product_id: item.productId,
        quantity: item.quantity,
        free_quantity: item.freeQuantity,
        unit_cost: item.unitPrice,
        actual_unit_cost: actualCost,
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

    if (itemsError) throw itemsError;

    // 7. Update stock and cost layers for new items
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

      const { data: currentStock } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("product_id", item.productId)
        .eq("location_id", location.id)
        .maybeSingle();

      if (currentStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Number(currentStock.quantity) + totalQty,
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", item.productId)
          .eq("location_id", location.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id: item.productId,
          location_id: location.id,
          quantity: totalQty,
        });
      }

      await supabaseAdmin.from("product_cost_layers").insert({
        product_id: item.productId,
        purchase_id: id,
        cost_price: processedItem.actual_unit_cost,
        original_quantity: totalQty,
        remaining_quantity: totalQty,
      });
    }

    // 8. Update purchase header
    const { error: updateError } = await supabaseAdmin
      .from("purchases")
      .update({
        supplier_id: val.supplier_id,
        invoice_no: val.invoice_number,
        purchase_date: val.purchase_date,
        arrival_date: val.arrival_date || null,
        total_amount: val.total_amount,
        extra_discount: val.extra_discount,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({ message: "Purchase Updated", id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
