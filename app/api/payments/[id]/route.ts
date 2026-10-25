import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_NAMES, BUSINESS_IDS } from "@/app/config/business-constants";
import { triggerAgencyBillsForInvoice } from "@/app/lib/inter-branch-billing";

const goodsItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["own_product", "external_goods"]).optional(),
  isCustomerPurchased: z.boolean().optional(),
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  invoiceNo: z.string().optional().nullable(),
  manualInvoiceNo: z.string().optional().nullable(),
  // Set when the item is an approved return-note credit (stock already handled)
  returnNumber: z.string().optional().nullable(),
  returnType: z.enum(["Good", "Damage"]).optional().nullable(),
  locationId: z.string().optional().nullable(),
  quantity: z.number().min(0.0001, "Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price cannot be negative"),
  totalValue: z.number().min(0, "Total value cannot be negative"),
});

const patchPaymentSchema = z.object({
  amount: z.number().min(0.001, "Amount must be greater than 0"),
  date: z.string().optional().nullable(),
  payment_date: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  payment_method: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  chequeNo: z.string().optional().nullable(),
  chequeDate: z.string().optional().nullable(),
  chequeStatus: z.string().optional().nullable(),
  bankId: z.string().optional().nullable(),
  branchCode: z.string().optional().nullable(),
  depositAccountId: z.string().optional().nullable(),
  receiptNumber: z.string().optional().nullable(),
  receiptBookId: z.string().optional().nullable(),
  goodsItems: z.array(goodsItemSchema).optional().nullable(),
  goodsSummary: z.string().optional().nullable(),
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
  performedById: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: payment, error: pError } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        customers (
          id,
          shop_name,
          owner_name,
          phone
        ),
        invoices (
          id,
          invoice_no,
          total_amount,
          paid_amount,
          orders (
            id,
            order_id,
            business_id,
            businesses (
              id,
              name
            )
          )
        ),
        bank_codes (
          id,
          bank_name,
          bank_code
        ),
        bank_accounts (
          id,
          account_name,
          account_type
        )
      `)
      .eq("id", id)
      .single();

    if (pError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    let goodsItems: any[] = [];
    if (payment.method === "goods") {
      const rawDetails = (payment.cheque_no || "").replace(/^Goods:\s*/i, "").trim();
      const chunks = rawDetails ? rawDetails.split(/\s*;\s*/).filter(Boolean) : [];

      // Query products for matching SKU / ID / names if chunks exist
      let allProducts: any[] = [];
      if (chunks.length > 0) {
        const { data: prods } = await supabaseAdmin
          .from("products")
          .select("id, name, sku, company_code, selling_price, cost_price");
        allProducts = prods || [];
      }

      // Query inventory returns
      let { data: returnsData } = await supabaseAdmin
        .from("inventory_returns")
        .select(`
          id,
          return_number,
          product_id,
          location_id,
          business_id,
          customer_id,
          quantity,
          return_type,
          reason,
          return_date,
          products (
            id,
            name,
            sku,
            company_code,
            selling_price,
            cost_price
          ),
          locations (
            id,
            name
          )
        `)
        .ilike("reason", `%[PAY:${id}]%`);

      // Fallback: query by invoice_no in reason if not tagged with [PAY:id]
      if (!returnsData || returnsData.length === 0) {
        const invNo = payment.invoices?.invoice_no;
        if (invNo) {
          const { data: fallbackReturns } = await supabaseAdmin
            .from("inventory_returns")
            .select(`
              id,
              return_number,
              product_id,
              location_id,
              business_id,
              customer_id,
              quantity,
              return_type,
              reason,
              return_date,
              products (
                id,
                name,
                sku,
                company_code,
                selling_price,
                cost_price
              ),
              locations (
                id,
                name
              )
            `)
            .ilike("reason", `%Payment Goods Settlement for ${invNo}%`)
            .eq("customer_id", payment.customer_id);

          returnsData = fallbackReturns || [];
        }
      }

      // If structured chunks exist in cheque_no, prioritize parsing them for accurate unit rates and bill refs
      if (chunks.length > 0) {
        goodsItems = chunks.map((chunk: string, idx: number) => {
          const trimmed = chunk.trim();
          let amount = 0;
          const amountMatch = trimmed.match(/@\s*(?:LKR\s*)?([\d,]+(?:\.\d+)?)/i);
          if (amountMatch) {
            amount = parseFloat(amountMatch[1].replace(/,/g, "")) || 0;
          }

          const isSoldToCustomer =
            trimmed.includes("CustomerBilled") ||
            trimmed.includes("SoldToCust") ||
            (!trimmed.includes("OtherAgencyStock") && /Bill:\s*|Manual:\s*/i.test(trimmed));

          let manualRef = "";
          const manualMatch = trimmed.match(/Manual:\s*([^,\)]+)/i);
          if (manualMatch) manualRef = manualMatch[1].trim();

          let invoiceNo = "";
          const billMatch = trimmed.match(/Bill:\s*([^,\)]+)/i);
          if (billMatch) invoiceNo = billMatch[1].trim();

          // "Return Note: RET-..." marks an approved return-note credit
          const returnNumber = trimmed.match(/Return Note:\s*([^,\)|]+)/i)?.[1]?.trim() || undefined;

          const returnType: "Good" | "Damage" = /Damage/i.test(trimmed) ? "Damage" : "Good";

          let cleanName = trimmed;
          const pIdx = cleanName.indexOf("(");
          if (pIdx !== -1) cleanName = cleanName.substring(0, pIdx).trim();
          cleanName = cleanName.replace(/^(?:goods(?:\s+settlement)?:\s*)/i, "").trim();

          let qty = 1;
          const qtyMatch = cleanName.match(/^(\d+(?:\.\d+)?)\s*x\s+/i);
          if (qtyMatch) {
            qty = parseFloat(qtyMatch[1]) || 1;
            cleanName = cleanName.substring(qtyMatch[0].length).trim();
          }

          const unitPrice = qty > 0 && amount > 0 ? Math.round((amount / qty) * 100) / 100 : amount;

          // Match product by exact or trimmed name
          const matchedProd = allProducts.find(
            (p: any) => p.name.trim().toLowerCase() === cleanName.trim().toLowerCase()
          ) || allProducts.find(
            (p: any) => cleanName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(cleanName.toLowerCase())
          );

          // Find corresponding return record if available
          const matchedRet = returnsData?.find((r: any) => {
            const rProd = Array.isArray(r.products) ? r.products[0] : r.products;
            return (matchedProd && r.product_id === matchedProd.id) || rProd?.name?.trim().toLowerCase() === cleanName.trim().toLowerCase();
          });

          const retProd = matchedRet ? (Array.isArray(matchedRet.products) ? matchedRet.products[0] : matchedRet.products) : null;
          const retLoc = matchedRet ? (Array.isArray(matchedRet.locations) ? matchedRet.locations[0] : matchedRet.locations) : null;

          return {
            id: matchedRet?.id || `goods_item_${idx}_${Date.now()}`,
            type: "own_product",
            isCustomerPurchased: isSoldToCustomer,
            productId: matchedProd?.id || matchedRet?.product_id || "",
            productName: matchedProd?.name || retProd?.name || cleanName,
            sku: matchedProd?.sku || retProd?.sku || "",
            companyCode: matchedProd?.company_code || retProd?.company_code || "",
            invoiceNo: invoiceNo || undefined,
            manualInvoiceNo: manualRef || undefined,
            returnNumber,
            returnType: returnType,
            locationId: matchedRet?.location_id || "0b68fd7b-6a40-496f-9279-0a003c26b211",
            locationName: retLoc?.name || "Main Warehouse",
            quantity: qty,
            unitPrice: unitPrice,
            totalValue: Math.round(qty * unitPrice * 100) / 100,
          };
        });
      } else if (returnsData && returnsData.length > 0) {
        goodsItems = returnsData.map((r: any) => {
          const reasonStr = r.reason || "";
          const rProd = Array.isArray(r.products) ? r.products[0] : r.products;
          const rLoc = Array.isArray(r.locations) ? r.locations[0] : r.locations;
          let unitPrice = Number(rProd?.selling_price || 0);
          const priceMatch = reasonStr.match(/\[PRICE:([\d.]+)\]/);
          if (priceMatch) {
            unitPrice = parseFloat(priceMatch[1]) || unitPrice;
          } else if (returnsData.length === 1 && Number(r.quantity) > 0) {
            unitPrice = Math.round((Number(payment.amount) / Number(r.quantity)) * 100) / 100;
          }

          let invoiceNo = "";
          const invMatch = reasonStr.match(/\[INV:([^\]]*)\]/);
          if (invMatch) invoiceNo = invMatch[1].trim();

          let manualInvoiceNo = "";
          const manMatch = reasonStr.match(/\[MAN:([^\]]*)\]/);
          if (manMatch) manualInvoiceNo = manMatch[1].trim();

          const isPurchased = !reasonStr.toLowerCase().includes("other stock") && !!invoiceNo;

          return {
            id: r.id,
            type: "own_product",
            isCustomerPurchased: isPurchased,
            productId: r.product_id,
            productName: rProd?.name || "Unknown Product",
            sku: rProd?.sku || "",
            companyCode: rProd?.company_code || "",
            invoiceNo: invoiceNo || undefined,
            manualInvoiceNo: manualInvoiceNo || undefined,
            returnType: r.return_type || "Good",
            locationId: r.location_id,
            locationName: rLoc?.name || "Main Warehouse",
            quantity: Number(r.quantity),
            unitPrice: unitPrice,
            totalValue: Math.round(Number(r.quantity) * unitPrice * 100) / 100,
          };
        });
      }
    }

    return NextResponse.json({
      payment,
      goodsItems,
    });
  } catch (error: any) {
    console.error("GET /api/payments/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const val = patchPaymentSchema.parse(body);

    // 1. Fetch current payment with invoice and customer
    const { data: payment, error: pError } = await supabaseAdmin
      .from("payments")
      .select(`
        *,
        invoices (
          id,
          invoice_no,
          paid_amount,
          total_amount,
          orders (
            id,
            order_id,
            business_id,
            businesses (
              id,
              name
            )
          )
        ),
        customers (
          id,
          shop_name,
          outstanding_balance
        )
      `)
      .eq("id", id)
      .single();

    if (pError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (payment.is_cancelled) {
      return NextResponse.json(
        { error: "Cannot edit a cancelled payment" },
        { status: 400 }
      );
    }

    const invoice = payment.invoices;
    const customer = payment.customers;
    const orderData = Array.isArray(invoice?.orders) ? invoice.orders[0] : invoice?.orders;
    const businessId = orderData?.business_id || BUSINESS_IDS.SIERRA_AGENCY;

    const oldAmount = Number(payment.amount) || 0;
    const newAmount = Number(val.amount);
    const amountDifference = newAmount - oldAmount;

    const oldMethod = payment.method || "cash";
    const newMethod = (val.method || val.payment_method || oldMethod) as string;
    const paymentDate = val.date || val.payment_date || payment.payment_date;

    // 2. Handle Goods Settlement changes
    if (oldMethod === "goods" || newMethod === "goods") {
      // Find old return records for this payment to reverse their stock
      let { data: oldReturns } = await supabaseAdmin
        .from("inventory_returns")
        .select("id, product_id, location_id, quantity, return_type")
        .ilike("reason", `%[PAY:${id}]%`);

      if (!oldReturns || oldReturns.length === 0) {
        if (invoice?.invoice_no) {
          const { data: legacyReturns } = await supabaseAdmin
            .from("inventory_returns")
            .select("id, product_id, location_id, quantity, return_type")
            .ilike("reason", `%Payment Goods Settlement for ${invoice.invoice_no}%`)
            .eq("customer_id", customer.id);
          oldReturns = legacyReturns || [];
        }
      }

      // Reverse previously returned stock
      if (oldReturns && oldReturns.length > 0) {
        for (const ret of oldReturns) {
          const retQty = Number(ret.quantity);
          const retType = ret.return_type === "Damage" ? "Damage" : "Good";

          // Decrement product_stocks
          const { data: stockRow } = await supabaseAdmin
            .from("product_stocks")
            .select("id, quantity, damaged_quantity")
            .eq("product_id", ret.product_id)
            .eq("location_id", ret.location_id)
            .maybeSingle();

          if (stockRow) {
            if (retType === "Damage") {
              await supabaseAdmin
                .from("product_stocks")
                .update({
                  damaged_quantity: Math.max(0, (Number(stockRow.damaged_quantity) || 0) - retQty),
                  last_updated: new Date().toISOString(),
                })
                .eq("id", stockRow.id);
            } else {
              await supabaseAdmin
                .from("product_stocks")
                .update({
                  quantity: Math.max(0, (Number(stockRow.quantity) || 0) - retQty),
                  last_updated: new Date().toISOString(),
                })
                .eq("id", stockRow.id);
            }
          }

          // Decrement products table
          const { data: prodRow } = await supabaseAdmin
            .from("products")
            .select("id, stock_quantity, damaged_quantity")
            .eq("id", ret.product_id)
            .maybeSingle();

          if (prodRow) {
            if (retType === "Damage") {
              await supabaseAdmin
                .from("products")
                .update({
                  damaged_quantity: Math.max(0, (Number(prodRow.damaged_quantity) || 0) - retQty),
                })
                .eq("id", ret.product_id);
            } else {
              await supabaseAdmin
                .from("products")
                .update({
                  stock_quantity: Math.max(0, (Number(prodRow.stock_quantity) || 0) - retQty),
                })
                .eq("id", ret.product_id);
            }
          }

          // Delete old return record
          await supabaseAdmin.from("inventory_returns").delete().eq("id", ret.id);
        }
      }

      // If new payment is still goods, insert the updated return records & apply new stock
      if (newMethod === "goods" && val.goodsItems && Array.isArray(val.goodsItems)) {
        for (const item of val.goodsItems) {
          // Skip items from an approved return note — their stock was handled on approval
          if (item.productId && item.quantity > 0 && !item.returnNumber) {
            const retNumber = `RET-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
            const targetLocId = item.locationId || "0b68fd7b-6a40-496f-9279-0a003c26b211";
            const itemRetType = item.returnType === "Damage" ? "Damage" : "Good";

            const isValidUuid = (str: any) =>
              typeof str === "string" &&
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
            const returnedByUuid = isValidUuid(val.performedById) ? val.performedById : null;

            // Insert new return record tagged with [PAY:id]
            await supabaseAdmin.from("inventory_returns").insert({
              return_number: retNumber,
              product_id: item.productId,
              location_id: targetLocId,
              business_id: businessId,
              customer_id: customer.id,
              quantity: Number(item.quantity),
              return_type: itemRetType,
              reason: `Payment Goods Settlement for ${invoice.invoice_no}${item.invoiceNo ? ` (ref: ${item.invoiceNo})` : ""}${item.manualInvoiceNo ? ` (manual ref: ${item.manualInvoiceNo})` : ""} [PAY:${id}] [PRICE:${item.unitPrice}] [INV:${item.invoiceNo || ""}] [MAN:${item.manualInvoiceNo || ""}]`,
              status: "Completed",
              returned_by: returnedByUuid,
              return_date: paymentDate,
            });

            // Increment product_stocks
            const { data: newStockRow } = await supabaseAdmin
              .from("product_stocks")
              .select("id, quantity, damaged_quantity")
              .eq("product_id", item.productId)
              .eq("location_id", targetLocId)
              .maybeSingle();

            if (itemRetType === "Damage") {
              if (newStockRow) {
                await supabaseAdmin
                  .from("product_stocks")
                  .update({
                    damaged_quantity: (Number(newStockRow.damaged_quantity) || 0) + Number(item.quantity),
                    last_updated: new Date().toISOString(),
                  })
                  .eq("id", newStockRow.id);
              } else {
                await supabaseAdmin.from("product_stocks").insert({
                  product_id: item.productId,
                  location_id: targetLocId,
                  quantity: 0,
                  damaged_quantity: Number(item.quantity),
                  last_updated: new Date().toISOString(),
                });
              }
            } else {
              if (newStockRow) {
                await supabaseAdmin
                  .from("product_stocks")
                  .update({
                    quantity: (Number(newStockRow.quantity) || 0) + Number(item.quantity),
                    last_updated: new Date().toISOString(),
                  })
                  .eq("id", newStockRow.id);
              } else {
                await supabaseAdmin.from("product_stocks").insert({
                  product_id: item.productId,
                  location_id: targetLocId,
                  quantity: Number(item.quantity),
                  damaged_quantity: 0,
                  last_updated: new Date().toISOString(),
                });
              }
            }

            // Increment products table
            const { data: newProdRow } = await supabaseAdmin
              .from("products")
              .select("id, stock_quantity, damaged_quantity")
              .eq("id", item.productId)
              .maybeSingle();

            if (newProdRow) {
              if (itemRetType === "Damage") {
                await supabaseAdmin
                  .from("products")
                  .update({
                    damaged_quantity: (Number(newProdRow.damaged_quantity) || 0) + Number(item.quantity),
                  })
                  .eq("id", item.productId);
              } else {
                await supabaseAdmin
                  .from("products")
                  .update({
                    stock_quantity: (Number(newProdRow.stock_quantity) || 0) + Number(item.quantity),
                  })
                  .eq("id", item.productId);
              }
            }
          }
        }

        // Re-trigger inter-branch billing if goods were returned in Distribution or Retail
        const returnedPids = val.goodsItems
          .filter((it: any) => it.productId)
          .map((it: any) => it.productId);

        if (
          returnedPids.length > 0 &&
          (businessId === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION || businessId === BUSINESS_IDS.CHAMPIKA_RETAIL)
        ) {
          triggerAgencyBillsForInvoice(businessId, returnedPids).catch((err) =>
            console.error("[InterBranch] Edit payment goods return trigger error:", err)
          );
        }
      }
    }

    // 3. Bank Account Balances adjustments (for Cash/Bank payments)
    const oldAccountId = payment.deposit_account_id;
    const newAccountId = val.depositAccountId || oldAccountId;

    if (oldMethod === "cash" || oldMethod === "bank" || (oldMethod === "cheque" && payment.cheque_status === "Cleared")) {
      if (oldAccountId) {
        // Reverse old amount
        const { data: oldAcc } = await supabaseAdmin
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", oldAccountId)
          .single();
        if (oldAcc) {
          await supabaseAdmin
            .from("bank_accounts")
            .update({
              current_balance: Number(oldAcc.current_balance || 0) - oldAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", oldAccountId);
        }
      }
    }

    if (newMethod === "cash" || newMethod === "bank" || (newMethod === "cheque" && val.chequeStatus === "Cleared")) {
      if (newAccountId) {
        // Add new amount
        const { data: newAcc } = await supabaseAdmin
          .from("bank_accounts")
          .select("current_balance")
          .eq("id", newAccountId)
          .single();
        if (newAcc) {
          await supabaseAdmin
            .from("bank_accounts")
            .update({
              current_balance: Number(newAcc.current_balance || 0) + newAmount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", newAccountId);
        }
      }
    }

    // 4. Update Invoice & Customer Balances
    if (amountDifference !== 0 && invoice) {
      const invTotal = Number(invoice.total_amount || 0);
      const currPaid = Number(invoice.paid_amount || 0);
      const updatedPaidAmount = Math.max(0, currPaid + amountDifference);
      const isFullyPaid = (invTotal - updatedPaidAmount) < 100;
      const finalPaidAmount = isFullyPaid ? invTotal : updatedPaidAmount;
      const newStatus = isFullyPaid ? "Paid" : finalPaidAmount > 0 ? "Partial" : "Unpaid";

      await supabaseAdmin
        .from("invoices")
        .update({
          paid_amount: finalPaidAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoice.id);

      if (orderData?.id) {
        await supabaseAdmin
          .from("orders")
          .update({ payment_status: newStatus })
          .eq("id", orderData.id);
      }

      if (customer?.id) {
        const currBalance = Number(customer.outstanding_balance || 0);
        await supabaseAdmin
          .from("customers")
          .update({
            outstanding_balance: currBalance - amountDifference,
            updated_at: new Date().toISOString(),
          })
          .eq("id", customer.id);
      }
    }

    // 5. Update Payments Table Row
    let goodsSummaryText = val.goodsSummary;
    if (newMethod === "goods" && val.goodsItems && Array.isArray(val.goodsItems) && val.goodsItems.length > 0) {
      goodsSummaryText = val.goodsItems
        .map((item: any) => {
          const parts = [
            item.invoiceNo ? `Bill: ${item.invoiceNo}` : null,
            item.manualInvoiceNo ? `Manual: ${item.manualInvoiceNo}` : null,
            item.isCustomerPurchased !== false ? "CustomerBilled" : "OtherAgencyStock",
          ].filter(Boolean).join(", ");
          const total = item.totalValue ?? (item.quantity * item.unitPrice);
          return `${item.quantity}x ${item.productName} (${item.returnType || "Good"}${parts ? ` | ${parts}` : ""}) @ LKR ${Number(total).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        })
        .join(" ; ");
    }

    const chequeNo =
      newMethod === "goods"
        ? (goodsSummaryText ? `Goods: ${goodsSummaryText}` : "Goods Settlement")
        : newMethod === "cheque"
        ? (val.branchCode ? `${val.chequeNo} (Branch: ${val.branchCode})` : val.chequeNo || null)
        : null;

    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        amount: newAmount,
        payment_date: paymentDate,
        method: newMethod,
        cheque_no: chequeNo,
        cheque_date: newMethod === "cheque" ? val.chequeDate || null : null,
        cheque_status: newMethod === "cheque" ? val.chequeStatus || payment.cheque_status || "Pending" : null,
        bank_id: newMethod === "cheque" ? val.bankId || null : null,
        deposit_account_id: (newMethod === "cash" || newMethod === "bank") ? newAccountId : null,
        receipt_number: val.receiptNumber || null,
        receipt_book_id: val.receiptBookId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Sync updated goodsSummary to sibling goods payments on the same date for the same customer
    if (newMethod === "goods" && chequeNo && customer?.id) {
      await supabaseAdmin
        .from("payments")
        .update({
          cheque_no: chequeNo,
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", customer.id)
        .eq("method", "goods")
        .eq("payment_date", paymentDate)
        .neq("id", id);
    }

    // 6. Audit Trail: Activity Record
    try {
      const bName = (BUSINESS_NAMES as Record<string, string>)[businessId] || "Office";
      await supabaseAdmin.from("activity_records").insert({
        portal: "office",
        business_id: businessId,
        business_name: bName,
        action_type: "payment_updated",
        record_type: "Payment Updated",
        entity_type: "payment",
        entity_id: id,
        entity_no: invoice?.invoice_no,
        customer_id: customer?.id,
        customer_name: customer?.shop_name,
        amount: newAmount,
        performed_by_name: val.performedByName || null,
        performed_by_email: val.performedByEmail || null,
        metadata: {
          previousAmount: oldAmount,
          newAmount,
          previousMethod: oldMethod,
          newMethod,
          amountDifference,
          invoiceNo: invoice?.invoice_no,
        },
      });
    } catch (auditErr) {
      console.error("Activity record warning on payment update:", auditErr);
    }

    return NextResponse.json({
      message: "Payment updated successfully",
      payment: updatedPayment,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("PATCH /api/payments/[id] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
