import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

// --- Validation Schemas ---
const invoiceItemSchema = z.object({
  productId: z.string(),
  sku: z.string().optional(),
  productName: z.string().optional(),
  quantity: z.number().min(1),
  freeQuantity: z.number().default(0),
  unit: z.string().optional(),
  mrp: z.number(),
  unitPrice: z.number(),
  // ✅ Discount Fields
  discountPercent: z.number().default(0),
  discountAmount: z.number().default(0),
  total: z.number(),
});

const updateInvoiceSchema = z.object({
  customerId: z.string().min(1),
  salesRepId: z.string().min(1),
  invoiceDate: z.string(),
  orderStatus: z.string(),
  items: z.array(invoiceItemSchema).min(1),
  grandTotal: z.number(),
  extraDiscountPercent: z.number().default(0),
  extraDiscountAmount: z.number().default(0),
  notes: z.string().optional(),
  manual_invoice_no: z.string().optional(),
  userId: z.string().optional(),
  isDraft: z.boolean().optional(),
  changeReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    // 1. Fetch Invoice & Customer Details
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        customers (
          id,
          shop_name,
          owner_name,
          phone,
          address
        ),
        orders (
          id,
          sales_rep_id,
          status,
          order_date,
          notes,
          extra_discount_percent,
          extra_discount_amount,
          profiles!orders_sales_rep_id_fkey (
            full_name
          )
        )
      `,
      )
      .eq("id", id)
      .single();

    if (invError) {
      console.error("Invoice fetch error:", invError);
      throw new Error(invError.message);
    }
    if (!invoice) throw new Error("Invoice not found");

    // 2. Fetch Order Items with FULL Product Details
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        *,
        products (
          id,
          name,
          sku,
          mrp,
          selling_price,
          stock_quantity,
          unit_of_measure,
          description,
          category,
          brand,
          model_type,
          size_spec
        )
      `,
      )
      .eq("order_id", invoice.order_id);

    if (itemsError) throw itemsError;

    // 3. Fetch Payments
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("invoice_id", id)
      .order("payment_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    // 4. Construct Response
    const fullInvoice = {
      id: invoice.id,
      orderId: invoice.order_id,
      invoiceNo: invoice.invoice_no,
      manualInvoiceNo: invoice.manual_invoice_no || "",
      date: invoice.orders?.order_date
        ? new Date(invoice.orders.order_date).toISOString().split("T")[0]
        : invoice.created_at.split("T")[0],
      customerId: invoice.customer_id,
      salesRepId: invoice.orders?.sales_rep_id,
      orderStatus: invoice.orders?.status,
      notes: invoice.orders?.notes,
      grandTotal: invoice.total_amount,
      paidAmount: invoice.paid_amount,
      dueDate: invoice.due_date || null,

      // Extra Discount
      extraDiscountPercent: invoice.orders?.extra_discount_percent || 0,
      extraDiscountAmount: invoice.orders?.extra_discount_amount || 0,

      // Customer Info
      customer: {
        shop: invoice.customers?.shop_name || "",
        name: invoice.customers?.owner_name || "",
        phone: invoice.customers?.phone || "",
        address: invoice.customers?.address || "",
      },
      salesRep: invoice.orders?.profiles?.full_name || "Unknown",
      totals: { grandTotal: invoice.total_amount },

      // ✅ ITEMS MAPPING (Including Full Product Details)
      items: items.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        sku: item.products?.sku || "N/A",

        // Product Identity
        productName: item.products?.name || "Unknown Product",
        name: item.products?.name, // Alias for some UIs
        description: item.products?.description || "",
        category: item.products?.category || "",
        brand: item.products?.brand || "",
        model: item.products?.model_type || "",
        size: item.products?.size_spec || "",

        // Pricing & Qty
        price: item.unit_price,
        unit: item.products?.unit_of_measure || "Unit",
        quantity: item.quantity,
        free: item.free_quantity, // Alias
        freeQuantity: item.free_quantity,

        mrp: item.products?.mrp || 0,
        unitPrice: item.unit_price,

        // Item Discount
        discountPercent: item.discount_percent || 0,
        discountAmount: item.discount_amount || 0,

        total: item.total_price,

        // Stock Context (Current)
        stockAvailable:
          (item.products?.stock_quantity || 0) +
          (item.quantity || 0) +
          (item.free_quantity || 0),
      })),

      // Payments
      payments: payments || [],
    };

    return NextResponse.json(fullInvoice);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const val = updateInvoiceSchema.parse(body);

    // Duplicate manual invoice number check (exclude current invoice)
    if (val.manual_invoice_no) {
      const { data: dup } = await supabaseAdmin
        .from("invoices")
        .select("invoice_no")
        .eq("manual_invoice_no", val.manual_invoice_no)
        .neq("id", id)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { error: `Manual invoice number "${val.manual_invoice_no}" is already used by invoice ${dup.invoice_no}. Please use a unique reference number.` },
          { status: 409 }
        );
      }
    }

    // 1. Fetch Current Invoice State (Snapshot for History)
    const { data: currentInvoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `
        *,
        orders (*)
      `,
      )
      .eq("id", id)
      .single();

    if (invError || !currentInvoice) {
      console.error("Invoice fetch error:", invError);
      return NextResponse.json(
        { error: "Invoice not found or DB error" },
        { status: 404 },
      );
    }

    // 2. Fetch Items Separately for Snapshot
    const { data: currentItems } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", currentInvoice.order_id);

    // 3. Save Snapshot to History
    if (val.userId) {
      const snapshotData = {
        ...currentInvoice,
        items: currentItems,
      };

      await supabaseAdmin.from("invoice_history").insert({
        invoice_id: id,
        previous_data: snapshotData,
        changed_by: val.userId,
        change_reason: val.changeReason || "Updated details",
      });
    }

    // 4. Prepare Updates
    const newStatus = val.isDraft ? "Pending" : val.orderStatus;

    // --- REVERT OLD STOCK & BALANCE ---

    // A. Revert Customer Balance
    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", currentInvoice.customer_id)
      .single();

    if (customer) {
      const revertedBalance =
        (customer.outstanding_balance || 0) - currentInvoice.total_amount;
      await supabaseAdmin
        .from("customers")
        .update({ outstanding_balance: revertedBalance })
        .eq("id", currentInvoice.customer_id);
    }

    // B. Revert Stock (Global + Location)
    if (currentItems) {
      // Fetch the original rep's assigned locations so we can restore location stock
      const originalRepId = (currentInvoice.orders as any)?.sales_rep_id;
      let originalLocationIds: string[] = [];
      if (originalRepId) {
        const { data: origAssignments } = await supabaseAdmin
          .from("location_assignments")
          .select("location_id")
          .eq("user_id", originalRepId);
        originalLocationIds = origAssignments?.map((a: any) => a.location_id) ?? [];
      }

      for (const item of currentItems) {
        const totalQty = item.quantity + (item.free_quantity || 0);

        // Restore global stock
        const { data: prod } = await supabaseAdmin
          .from("products")
          .select("stock_quantity")
          .eq("id", item.product_id)
          .single();

        if (prod) {
          await supabaseAdmin
            .from("products")
            .update({ stock_quantity: prod.stock_quantity + totalQty })
            .eq("id", item.product_id);
        }

        // Restore location stock — add quantity back to the location that had the most stock
        // (mirrors the "highest stock first" deduction used during invoice creation/edit)
        if (originalLocationIds.length > 0) {
          const { data: locationStocks } = await supabaseAdmin
            .from("product_stocks")
            .select("id, quantity")
            .eq("product_id", item.product_id)
            .in("location_id", originalLocationIds)
            .order("quantity", { ascending: false });

          if (locationStocks && locationStocks.length > 0) {
            // Restore all to the highest-stocked location (the one that was deducted first)
            await supabaseAdmin
              .from("product_stocks")
              .update({ quantity: locationStocks[0].quantity + totalQty })
              .eq("id", locationStocks[0].id);
          }
        }
      }

      // C. Delete Old Items
      await supabaseAdmin
        .from("order_items")
        .delete()
        .eq("order_id", currentInvoice.order_id);
    }

    // --- APPLY NEW DATA ---

    // Update Order
    await supabaseAdmin
      .from("orders")
      .update({
        customer_id: val.customerId,
        sales_rep_id: val.salesRepId,
        order_date: val.invoiceDate,
        status: newStatus,
        total_amount: val.grandTotal,
        notes: val.notes,
        // ✅ Update Extra Discount
        extra_discount_percent: val.extraDiscountPercent,
        extra_discount_amount: val.extraDiscountAmount,
      })
      .eq("id", currentInvoice.order_id);

    // Update Invoice
    await supabaseAdmin
      .from("invoices")
      .update({
        customer_id: val.customerId,
        total_amount: val.grandTotal,
        ...(val.manual_invoice_no !== undefined && { manual_invoice_no: val.manual_invoice_no }),
      })
      .eq("id", id);

    // Build historical cost map from old items (preserves original cost for unchanged products)
    const oldCostMap: Record<string, number> = {};
    if (currentItems) {
      for (const ci of currentItems) {
        if (ci.actual_unit_cost != null && !oldCostMap[ci.product_id]) {
          oldCostMap[ci.product_id] = Number(ci.actual_unit_cost);
        }
      }
    }

    // Fetch current cost for any newly added products not in the old items
    const newProductIds = val.items
      .map((i) => i.productId)
      .filter((pid) => oldCostMap[pid] == null);

    const freshCostMap: Record<string, number> = {};
    if (newProductIds.length > 0) {
      const { data: productCosts } = await supabaseAdmin
        .from("products")
        .select("id, actual_cost_price, cost_price")
        .in("id", newProductIds);

      if (productCosts) {
        for (const p of productCosts) {
          freshCostMap[p.id] =
            Number(p.actual_cost_price) || Number(p.cost_price) || 0;
        }
      }
    }

    // Insert New Items (with actual_unit_cost preserved/fetched)
    const newItemsData = val.items.map((item) => ({
      order_id: currentInvoice.order_id,
      product_id: item.productId,
      quantity: item.quantity,
      free_quantity: item.freeQuantity,
      unit_price: item.unitPrice,
      total_price: item.total,
      commission_earned: 0,
      discount_percent: item.discountPercent,
      discount_amount: item.discountAmount,
      actual_unit_cost:
        oldCostMap[item.productId] ?? freshCostMap[item.productId] ?? 0,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(newItemsData);

    if (insertError) throw insertError;

    // ------------------------------------------------------------------
    // Deduct New Stock (Global & Location Specific)
    // ------------------------------------------------------------------

    // 1. Get ALL assigned locations for the user
    const { data: assignments } = await supabaseAdmin
      .from("location_assignments")
      .select("location_id")
      .eq("user_id", val.salesRepId);

    const assignedLocationIds = assignments
      ? assignments.map((a) => a.location_id)
      : [];

    for (const item of val.items) {
      const totalQty = item.quantity + item.freeQuantity;

      // 2. Deduct Global Stock
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      if (prod) {
        await supabaseAdmin
          .from("products")
          .update({
            stock_quantity: Math.max(0, prod.stock_quantity - totalQty),
          })
          .eq("id", item.productId);
      }

      // 3. Deduct Location Stock
      if (assignedLocationIds.length > 0) {
        let remainingToDeduct = totalQty;

        const { data: locationStocks } = await supabaseAdmin
          .from("product_stocks")
          .select("id, location_id, quantity")
          .eq("product_id", item.productId)
          .in("location_id", assignedLocationIds)
          .gt("quantity", 0)
          .order("quantity", { ascending: false });

        if (locationStocks) {
          for (const stockRec of locationStocks) {
            if (remainingToDeduct <= 0) break;

            const available = stockRec.quantity;
            const deduct = Math.min(available, remainingToDeduct);

            await supabaseAdmin
              .from("product_stocks")
              .update({
                quantity: available - deduct,
              })
              .eq("id", stockRec.id);

            remainingToDeduct -= deduct;
          }
        }
      }
    }

    // Update Customer Balance (Add new total)
    const { data: currentCustomer } = await supabaseAdmin
      .from("customers")
      .select("outstanding_balance")
      .eq("id", val.customerId)
      .single();

    if (currentCustomer) {
      await supabaseAdmin
        .from("customers")
        .update({
          outstanding_balance:
            (currentCustomer.outstanding_balance || 0) + val.grandTotal,
        })
        .eq("id", val.customerId);
    }

    // Log invoice edit as a Sales transaction so it appears in Transaction History
    const invoiceNo = currentInvoice.invoice_no || id;
    const businessId = currentInvoice.business_id ?? null;
    if (businessId) {
      await supabaseAdmin.from("account_transactions").insert({
        transaction_no: `TXN-EDIT-${Date.now()}`,
        transaction_type: "Sales",
        from_account_id: null,
        to_account_id: null,
        amount: val.grandTotal,
        description: `Invoice Updated: ${invoiceNo}`,
        transaction_date: val.invoiceDate,
        business_id: businessId,
      });
    }

    return NextResponse.json({ message: "Invoice updated successfully" });
  } catch (error: any) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
