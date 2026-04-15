import { supabaseAdmin } from "@/lib/supabase-admin";
import { notFound } from "next/navigation";
import InvoicePrintView from "./InvoicePrintView";

async function getInvoice(id: string) {
  const { data: invoice, error: invError } = await supabaseAdmin
    .from("invoices")
    .select(
      `*, customers (id, shop_name, owner_name, phone, address),
       orders (id, sales_rep_id, status, order_date, notes, extra_discount_percent, extra_discount_amount,
         profiles!orders_sales_rep_id_fkey (full_name))`
    )
    .eq("id", id)
    .single();

  if (invError || !invoice) return null;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select(`*, products (id, name, sku, mrp, selling_price, unit_of_measure, supplier_name, brand)`)
    .eq("order_id", invoice.order_id);

  return {
    id: invoice.id,
    invoiceNo: invoice.invoice_no,
    date: invoice.orders?.order_date
      ? new Date(invoice.orders.order_date).toISOString().split("T")[0]
      : invoice.created_at.split("T")[0],
    grandTotal: invoice.total_amount,
    notes: invoice.orders?.notes,
    customer: {
      shop: invoice.customers?.shop_name || "",
      name: invoice.customers?.owner_name || "",
      phone: invoice.customers?.phone || "",
      address: invoice.customers?.address || "",
    },
    salesRep: invoice.orders?.profiles?.full_name || "Unknown",
    items: (items || []).map((item: any) => ({
      sku: item.products?.sku || "-",
      productName: item.products?.name || "Unknown Product",
      unitPrice: item.unit_price,
      quantity: item.quantity,
      unit: item.products?.unit_of_measure || "Pcs",
      freeQuantity: item.free_quantity || 0,
      discountPercent: item.discount_percent || 0,
      total: item.total_price,
      supplier: item.products?.supplier_name || item.products?.brand || null,
    })),
  };
}

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  return <InvoicePrintView invoice={invoice} />;
}
