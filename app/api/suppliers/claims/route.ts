import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supplierId, damageItemIds, allocations } = body;

    if (
      !supplierId ||
      !damageItemIds ||
      damageItemIds.length === 0 ||
      !allocations
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Fetch Selected Damages
    const { data: damages, error: dmgError } = await supabaseAdmin
      .from("inventory_returns")
      .select(`id, quantity, product_id, location_id, products (cost_price)`)
      .in("id", damageItemIds)
      .eq("return_type", "Damage");

    if (dmgError) throw dmgError;

    // Calculate Totals & Prepare Stock Updates
    let totalCreditAvailable = 0;
    const productUpdates: any[] = [];

    for (const item of damages) {
      // FIX: Handle 'products' whether it returns as an array or an object
      const productData = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      const cost = Number(productData?.cost_price) || 0;
      const qty = Number(item.quantity) || 0;

      totalCreditAvailable += cost * qty;

      productUpdates.push({
        productId: item.product_id,
        locationId: item.location_id,
        quantity: qty,
      });
    }

    const totalAllocated = allocations.reduce(
      (sum: number, a: any) => sum + Number(a.amount),
      0
    );

    // Validate Credit
    if (totalAllocated > totalCreditAvailable + 1) {
      // Allowing +1 buffer for rounding differences
      return NextResponse.json(
        {
          error: `Cannot allocate ${totalAllocated} when only ${totalCreditAvailable} credit is available.`,
        },
        { status: 400 }
      );
    }

    // --- EXECUTE TRANSACTIONS ---

    // 2. Reduce Damaged Stock Count (Physical Removal)
    for (const p of productUpdates) {
      // A. Update Master Product Catalog (Reduce Damaged Qty)
      const { data: prod } = await supabaseAdmin
        .from("products")
        .select("damaged_quantity")
        .eq("id", p.productId)
        .single();

      if (prod) {
        await supabaseAdmin
          .from("products")
          .update({
            damaged_quantity: Math.max(
              0,
              (prod.damaged_quantity || 0) - p.quantity
            ),
          })
          .eq("id", p.productId);
      }

      // B. Update Location Stock (Reduce Damaged Qty)
      if (p.locationId) {
        const { data: stock } = await supabaseAdmin
          .from("product_stocks")
          .select("id, damaged_quantity")
          .eq("product_id", p.productId)
          .eq("location_id", p.locationId)
          .single();

        if (stock) {
          await supabaseAdmin
            .from("product_stocks")
            .update({
              damaged_quantity: Math.max(
                0,
                (stock.damaged_quantity || 0) - p.quantity
              ),
            })
            .eq("id", stock.id);
        }
      }
    }

    // 3. Mark Damages as "Claimed"
    // This updates the record so it doesn't show up in the pending list again
    for (const id of damageItemIds) {
      const { data: current } = await supabaseAdmin
        .from("inventory_returns")
        .select("reason")
        .eq("id", id)
        .single();

      const newReason = `[CLAIMED] ${current?.reason || ""}`.substring(0, 255);

      await supabaseAdmin
        .from("inventory_returns")
        .update({
          reason: newReason,
          status: "Returned to Supplier", // Explicit status update
        })
        .eq("id", id);
    }

    // 4. Process Financial Allocations (Pay Bills with Credit)
    for (const alloc of allocations) {
      if (alloc.amount <= 0) continue;

      // A. Generate Payment Number (CN = Credit Note)
      const { count } = await supabaseAdmin
        .from("supplier_payments")
        .select("*", { count: "exact", head: true });
      const paymentNo = `CN-${(count || 0) + 1001}`;

      // B. Create Payment Record
      await supabaseAdmin.from("supplier_payments").insert({
        payment_number: paymentNo,
        purchase_id: alloc.purchaseId,
        supplier_id: supplierId,
        amount: alloc.amount,
        payment_date: new Date().toISOString(),
        payment_method: "return_credit",
        notes: "Credit for returned damaged goods",
      });

      // C. Update Purchase Bill Status
      const { data: purchase } = await supabaseAdmin
        .from("purchases")
        .select("total_amount, paid_amount")
        .eq("id", alloc.purchaseId)
        .single();

      if (purchase) {
        const newPaid = (purchase.paid_amount || 0) + alloc.amount;
        const newStatus = newPaid >= purchase.total_amount ? "Paid" : "Partial";

        await supabaseAdmin
          .from("purchases")
          .update({ paid_amount: newPaid, payment_status: newStatus })
          .eq("id", alloc.purchaseId);
      }
    }

    // 5. Update Supplier Total Balance
    const { data: sup } = await supabaseAdmin
      .from("suppliers")
      .select("due_payment")
      .eq("id", supplierId)
      .single();

    if (sup) {
      await supabaseAdmin
        .from("suppliers")
        .update({
          due_payment: Math.max(0, (sup.due_payment || 0) - totalAllocated),
        })
        .eq("id", supplierId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Claim API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
