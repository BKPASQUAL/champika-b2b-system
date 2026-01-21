import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceNo, purchaseDate, supplierId, billItems, explicitClaimIds } =
      body;
    const businessId = "094b649e-be59-4e2b-b709-7e36ad1ef280";

    // --- 1. Get Main Warehouse Location (Like Standard Purchase) ---
    let { data: location } = await supabaseAdmin
      .from("locations")
      .select("id")
      .is("business_id", null)
      .eq("name", "Main Warehouse")
      .maybeSingle();

    // Create Main Warehouse if it doesn't exist
    if (!location) {
      const { data: newLocation, error: locError } = await supabaseAdmin
        .from("locations")
        .insert({ name: "Main Warehouse", business_id: null })
        .select("id")
        .single();
      if (locError) throw new Error("Could not access Main Warehouse");
      location = newLocation;
    }

    // --- 2. Create Purchase Record ---
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("purchases")
      .insert({
        purchase_id: invoiceNo,
        invoice_no: invoiceNo,
        supplier_id: supplierId,
        business_id: businessId,
        purchase_date: purchaseDate,
        total_amount: 0,
        paid_amount: 0,
        payment_status: "Paid",
        status: "Received",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // --- 3. Process Items & Update Stocks ---
    const processedClaimIds: string[] = [];

    for (const item of billItems) {
      const qtyToAdd = Number(item.quantity);

      // A. Add Item to Purchase
      await supabaseAdmin.from("purchase_items").insert({
        purchase_id: purchase.id,
        product_id: item.productId,
        quantity: qtyToAdd,
        unit_cost: 0,
        total_cost: 0,
        selling_price: 0,
        mrp: 0,
      });

      // B. Update Catalog Stock (Products Table)
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("stock_quantity")
        .eq("id", item.productId)
        .single();

      const currentCatalogStock = Number(product?.stock_quantity || 0);

      await supabaseAdmin
        .from("products")
        .update({ stock_quantity: currentCatalogStock + qtyToAdd })
        .eq("id", item.productId);

      // C. Update Warehouse Stock (Product_Stocks Table) - NEW ADDITION
      const { data: currentLocStock } = await supabaseAdmin
        .from("product_stocks")
        .select("quantity")
        .eq("product_id", item.productId)
        .eq("location_id", location.id)
        .single();

      if (currentLocStock) {
        await supabaseAdmin
          .from("product_stocks")
          .update({
            quantity: Number(currentLocStock.quantity) + qtyToAdd,
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", item.productId)
          .eq("location_id", location.id);
      } else {
        await supabaseAdmin.from("product_stocks").insert({
          product_id: item.productId,
          location_id: location.id,
          quantity: qtyToAdd,
        });
      }

      // D. Auto-Reduce Claims Logic (FIFO)
      let qtyToMark = qtyToAdd;

      const { data: pendingItems } = await supabaseAdmin
        .from("order_items")
        .select("id, free_quantity")
        .eq("product_id", item.productId)
        .gt("free_quantity", 0)
        .or("claim_status.is.null,claim_status.eq.Unclaimed")
        .order("created_at", { ascending: true });

      if (pendingItems) {
        for (const pItem of pendingItems) {
          if (qtyToMark <= 0) break;
          processedClaimIds.push(pItem.id);
          qtyToMark -= Number(pItem.free_quantity);
        }
      }
    }

    // --- 4. Close Claims ---
    const finalIdsToUpdate = [
      ...new Set([...(explicitClaimIds || []), ...processedClaimIds]),
    ];

    if (finalIdsToUpdate.length > 0) {
      const { count } = await supabaseAdmin
        .from("supplier_claims")
        .select("*", { count: "exact", head: true });
      const claimNumber = `CLM-AUTO-${(count || 0) + 1001}`;

      const { data: claim } = await supabaseAdmin
        .from("supplier_claims")
        .insert({
          claim_number: claimNumber,
          supplier_id: supplierId,
          business_id: businessId,
          status: "Approved",
          total_claim_amount: 0,
          notes: `Auto-generated from Free Bill: ${invoiceNo}`,
        })
        .select()
        .single();

      await supabaseAdmin
        .from("order_items")
        .update({
          claim_status: "Approved",
          claim_batch_id: claim.id,
        })
        .in("id", finalIdsToUpdate);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Free Bill Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
