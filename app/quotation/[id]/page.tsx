import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import QuotationPrintView from "./QuotationPrintView";

async function getQuotation(id: string) {
  const { data: q, error: qError } = await supabaseAdmin
    .from("quotations")
    .select(
      `*, customers (id, shop_name, owner_name, phone, address)`
    )
    .eq("id", id)
    .single();

  if (qError || !q) return null;

  // Fetch sales rep full name
  let salesRepName = "Unknown";
  if (q.sales_rep_id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", q.sales_rep_id)
      .single();
    salesRepName = profile?.full_name || "Unknown";
  }

  return {
    id: q.id,
    quotationNo: q.quotation_no,
    date: q.invoice_date
      ? new Date(q.invoice_date).toISOString().split("T")[0]
      : q.created_at.split("T")[0],
    grandTotal: q.grand_total,
    notes: q.notes,
    customer: {
      shop: q.customers?.shop_name || "",
      name: q.customers?.owner_name || "",
      phone: q.customers?.phone || "",
      address: q.customers?.address || "",
    },
    salesRep: salesRepName,
    items: (q.items || []).map((item: any) => ({
      sku: item.sku || "-",
      productName: item.productName || item.name || "Unknown Product",
      unitPrice: item.unitPrice || item.price || 0,
      quantity: item.quantity || 0,
      unit: item.unit || "Pcs",
      freeQuantity: item.freeQuantity || item.free || 0,
      discountPercent: item.discountPercent || 0,
      total: item.total || 0,
      supplier: item.supplier || null,
    })),
  };
}

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const quotation = await getQuotation(id);
  if (!quotation) notFound();

  return <QuotationPrintView quotation={quotation} />;
}
