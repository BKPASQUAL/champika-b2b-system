import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();
    const month = searchParams.get("month"); // optional: 1-12
    const businessId = searchParams.get("businessId"); // optional: filter by portal

    // Build date range
    let from: string;
    let to: string;
    if (month) {
      const m = parseInt(month);
      const y = parseInt(year);
      from = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      to = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;
    } else {
      from = `${year}-01-01`;
      to = `${year}-12-31`;
    }

    // Fetch customer cheques
    let custQuery = supabaseAdmin
      .from("payments")
      .select(`
        id,
        cheque_no,
        cheque_date,
        amount,
        cheque_status,
        customers ( shop_name ),
        invoices!inner (
          invoice_no,
          orders!inner ( business_id )
        )
      `)
      .eq("method", "cheque")
      .gte("cheque_date", from)
      .lte("cheque_date", to)
      .order("cheque_date", { ascending: true });

    if (businessId) {
      custQuery = custQuery.eq("invoices.orders.business_id", businessId);
    }

    const { data: customerCheques, error: custErr } = await custQuery;
    if (custErr) throw custErr;

    // Fetch supplier cheques
    let supQuery = supabaseAdmin
      .from("supplier_payments")
      .select(`
        id,
        cheque_number,
        cheque_date,
        amount,
        cheque_status,
        payment_date,
        suppliers ( name ),
        purchases!inner ( business_id, purchase_id )
      `)
      .eq("payment_method", "cheque")
      .not("cheque_date", "is", null)
      .gte("cheque_date", from)
      .lte("cheque_date", to)
      .order("cheque_date", { ascending: true });

    if (businessId) {
      supQuery = supQuery.eq("purchases.business_id", businessId);
    }

    const { data: supplierCheques, error: supErr } = await supQuery;
    if (supErr) throw supErr;

    // Group customer cheques by (cheque_no, cheque_date, shop_name)
    const groupedCustomerCheques = new Map<string, any>();
    for (const p of (customerCheques || [])) {
      const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers;
      const shopName = customer?.shop_name || "Unknown";
      const invoice = Array.isArray(p.invoices) ? p.invoices[0] : p.invoices;
      const invoiceNo = invoice?.invoice_no || "N/A";
      
      const chqNo = (p.cheque_no || "").trim();
      const chqDate = p.cheque_date;
      
      const groupKey = chqNo 
        ? `${chqNo}_${chqDate}_${shopName}`
        : `single_${p.id}`;

      if (groupedCustomerCheques.has(groupKey)) {
        const existing = groupedCustomerCheques.get(groupKey);
        existing.amount += Number(p.amount);
        if (invoiceNo && invoiceNo !== "N/A" && !existing.invoiceNos.includes(invoiceNo)) {
          existing.invoiceNos.push(invoiceNo);
        }
      } else {
        groupedCustomerCheques.set(groupKey, {
          id: p.id,
          type: "customer" as const,
          date: p.cheque_date,
          cheque_number: p.cheque_no,
          amount: Number(p.amount),
          status: p.cheque_status,
          name: shopName,
          invoiceNos: invoiceNo && invoiceNo !== "N/A" ? [invoiceNo] : [],
        });
      }
    }

    const customerEvents = Array.from(groupedCustomerCheques.values()).map(item => ({
      id: item.id,
      type: item.type,
      date: item.date,
      cheque_number: item.cheque_number,
      amount: item.amount,
      status: item.status,
      name: item.name,
      reference: item.invoiceNos.length > 0 ? item.invoiceNos.join(", ") : "N/A",
    }));

    // Group supplier cheques by (cheque_number, cheque_date, supplier_name)
    const groupedSupplierCheques = new Map<string, any>();
    for (const p of (supplierCheques || [])) {
      const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
      const supplierName = supplier?.name || "Unknown Supplier";
      const purchase = Array.isArray(p.purchases) ? p.purchases[0] : p.purchases;
      const purchaseId = purchase?.purchase_id || "N/A";
      
      const chqNumber = (p.cheque_number || "").trim();
      const chqDate = p.cheque_date;
      
      const groupKey = chqNumber 
        ? `${chqNumber}_${chqDate}_${supplierName}`
        : `single_${p.id}`;

      if (groupedSupplierCheques.has(groupKey)) {
        const existing = groupedSupplierCheques.get(groupKey);
        existing.amount += Number(p.amount);
        if (purchaseId && purchaseId !== "N/A" && !existing.purchaseIds.includes(purchaseId)) {
          existing.purchaseIds.push(purchaseId);
        }
      } else {
        groupedSupplierCheques.set(groupKey, {
          id: p.id,
          type: "supplier" as const,
          date: p.cheque_date,
          cheque_number: p.cheque_number,
          amount: Number(p.amount),
          status: p.cheque_status,
          name: supplierName,
          purchaseIds: purchaseId && purchaseId !== "N/A" ? [purchaseId] : [],
          payment_date: p.payment_date,
        });
      }
    }

    const supplierEvents = Array.from(groupedSupplierCheques.values()).map(item => ({
      id: item.id,
      type: item.type,
      date: item.date,
      cheque_number: item.cheque_number,
      amount: item.amount,
      status: item.status,
      name: item.name,
      reference: item.purchaseIds.length > 0 ? item.purchaseIds.join(", ") : (item.payment_date || "N/A"),
    }));

    const events = [...customerEvents, ...supplierEvents];

    return NextResponse.json(events);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
