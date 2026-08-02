// app/api/orders/loading/reconcile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";
import { BUSINESS_IDS } from "@/app/config/business-constants";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const CHAMPIKA_BUSINESS_IDS = [
  BUSINESS_IDS.CHAMPIKA_RETAIL,
  BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Added userId to destructuring
    const { loadId, updates, closeLoad, userId } = body;

    if (!loadId || !updates) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // 1. Process Each Order Update
    for (const update of updates) {
      const { orderId, status, finalAmount, paymentStatus } = update;

      // Fetch current status before updating
      const { data: currentOrder } = await supabaseAdmin
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();

      // A. Update Order Status
      // Processing, Checking, Loading keep load_id so the lorry is remembered.
      // All other statuses also keep load_id to preserve history linkage.
      const finalStatus = status === "Returned" ? "Cancelled" : status;
      await supabaseAdmin
        .from("orders")
        .update({ status: finalStatus })
        .eq("id", orderId);

      // Trigger inter-branch bill when an order is marked Delivered
      if (finalStatus === "Delivered") {
        try {
          const { data: ord } = await supabaseAdmin
            .from("orders")
            .select("business_id")
            .eq("id", orderId)
            .single();

          if (ord && CHAMPIKA_BUSINESS_IDS.includes(ord.business_id)) {
            const { data: orderItems } = await supabaseAdmin
              .from("order_items")
              .select("product_id")
              .eq("order_id", orderId);

            const productIds = (orderItems || []).map((i: any) => i.product_id);
            await triggerAgencyBillsForInvoice(ord.business_id, productIds);
          }
        } catch (err) {
          console.error("Inter-branch billing failed (non-critical):", err);
        }
      }

      // B. Handle Invoice Updates
      const { data: invoice } = await supabaseAdmin
        .from("invoices")
        .select("id, total_amount, customer_id, invoice_no")
        .eq("order_id", orderId)
        .single();

      if (invoice) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              },
            },
          }
        );
        const { data: { user } } = await supabase.auth.getUser();
        const activeUserId = user?.id || userId || null;

        // Log status transition if changed
        if (currentOrder && currentOrder.status !== finalStatus) {
          await supabaseAdmin.from("invoice_history").insert({
            invoice_id: invoice.id,
            previous_data: {
              status: currentOrder.status,
              new_status: finalStatus,
            },
            changed_by: activeUserId,
            change_reason: `Reconciliation: Status updated from ${currentOrder.status} to ${finalStatus}`,
            changed_at: new Date().toISOString(),
          });
        }

        // Check if the amount passed from frontend differs from DB
        // (In the read-only UI flow, this likely won't trigger unless data changed mid-flight,
        // but it serves as a robust backend check)
        if (invoice.total_amount !== finalAmount) {
          // --- Audit Logging (If User ID Provided) ---
          if (activeUserId) {
            await supabaseAdmin.from("invoice_history").insert({
              invoice_id: invoice.id,
              previous_data: {
                total_amount: invoice.total_amount,
                status: "Reconciling",
              },
              changed_by: activeUserId, // Log the user
              change_reason: `Reconciliation: Amount adjusted from ${invoice.total_amount} to ${finalAmount}`,
              changed_at: new Date().toISOString(),
            });
          }

          // Update Invoice Table
          await supabaseAdmin
            .from("invoices")
            .update({ total_amount: finalAmount })
            .eq("id", invoice.id);

          // Update Customer Balance
          const diff = finalAmount - invoice.total_amount;
          if (diff !== 0) {
            const { data: customer } = await supabaseAdmin
              .from("customers")
              .select("outstanding_balance")
              .eq("id", invoice.customer_id)
              .single();

            if (customer) {
              await supabaseAdmin
                .from("customers")
                .update({
                  outstanding_balance:
                    (customer.outstanding_balance || 0) + diff,
                })
                .eq("id", invoice.customer_id);
            }
          }
        }

        // C. Update Payment Status (e.g. if marked Paid during recon)
        if (paymentStatus === "Paid") {
          await supabaseAdmin
            .from("invoices")
            .update({
              status: "Paid",
              paid_amount: finalAmount,
              due_amount: 0,
            })
            .eq("id", invoice.id);
        }
      }
    }

    // 2. Close the Load Sheet & Reconcile Returned Items Inventory
    if (closeLoad) {
      try {
        const { data: loadSheet } = await supabaseAdmin
          .from("loading_sheets")
          .select("id, orders(id, invoice_no, customer_id)")
          .eq("id", loadId)
          .single();

        if (loadSheet && loadSheet.orders) {
          const invoiceNos = (loadSheet.orders as any[])
            .map((o) => o.invoice_no)
            .filter(Boolean);

          if (invoiceNos.length > 0) {
            const orConditions = invoiceNos.map((invNo) => `reason.ilike.%${invNo}%`).join(",");
            const { data: returnRecords } = await supabaseAdmin
              .from("inventory_returns")
              .select("id, product_id, location_id, quantity, return_type, reason")
              .or(orConditions);

            if (returnRecords && returnRecords.length > 0) {
              for (const ret of returnRecords) {
                const qty = Number(ret.quantity) || 0;
                if (qty <= 0 || !ret.product_id) continue;

                if (ret.return_type === "Good") {
                  // Add back to current sellable stock
                  const { data: prod } = await supabaseAdmin
                    .from("products")
                    .select("stock_quantity")
                    .eq("id", ret.product_id)
                    .single();

                  if (prod) {
                    await supabaseAdmin
                      .from("products")
                      .update({ stock_quantity: (prod.stock_quantity || 0) + qty })
                      .eq("id", ret.product_id);
                  }

                  if (ret.location_id) {
                    const { data: locStock } = await supabaseAdmin
                      .from("product_stocks")
                      .select("id, quantity")
                      .eq("product_id", ret.product_id)
                      .eq("location_id", ret.location_id)
                      .maybeSingle();

                    if (locStock) {
                      await supabaseAdmin
                        .from("product_stocks")
                        .update({ quantity: (locStock.quantity || 0) + qty })
                        .eq("id", locStock.id);
                    }
                  }
                } else if (ret.return_type === "Damage") {
                  // Increment damaged stock in Damage Control
                  const { data: prod } = await supabaseAdmin
                    .from("products")
                    .select("damaged_quantity")
                    .eq("id", ret.product_id)
                    .single();

                  if (prod) {
                    await supabaseAdmin
                      .from("products")
                      .update({ damaged_quantity: (prod.damaged_quantity || 0) + qty })
                      .eq("id", ret.product_id);
                  }

                  if (ret.location_id) {
                    const { data: locStock } = await supabaseAdmin
                      .from("product_stocks")
                      .select("id, damaged_quantity")
                      .eq("product_id", ret.product_id)
                      .eq("location_id", ret.location_id)
                      .maybeSingle();

                    if (locStock) {
                      await supabaseAdmin
                        .from("product_stocks")
                        .update({ damaged_quantity: (locStock.damaged_quantity || 0) + qty })
                        .eq("id", locStock.id);
                    }
                  }

                  await supabaseAdmin
                    .from("inventory_returns")
                    .update({ reason: `${ret.reason || ""} [RECONCILED_DAMAGE]` })
                    .eq("id", ret.id);
                }
              }
            }
          }
        }
      } catch (stockErr) {
        console.error("Stock reconciliation error:", stockErr);
      }

      const { error: loadError } = await supabaseAdmin
        .from("loading_sheets")
        .update({ status: "Completed" })
        .eq("id", loadId);

      if (loadError) throw loadError;
    }

    return NextResponse.json({ message: "Reconciliation successful" });
  } catch (error: any) {
    console.error("Reconciliation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
