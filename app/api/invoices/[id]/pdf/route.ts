/**
 * GET /api/invoices/[id]/pdf?division=distribution
 *
 * Server-side PDF generation using Puppeteer (headless Chromium).
 * Produces output pixel-identical to the browser print engine —
 * the same result you'd get from File → Print → Save as PDF.
 */
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  generateInvoiceHTML,
  getDocumentWrapper,
  DIVISIONS,
} from "@/app/lib/invoice-html";
import { getBrowser } from "@/app/lib/browser";

async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await page.close().catch(() => {});
    if (process.env.VERCEL) await browser.close().catch(() => {});
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams, origin } = new URL(request.url);
  const divisionKey = (searchParams.get("division") ||
    "distribution") as keyof typeof DIVISIONS;

  try {
    // ── 1. Fetch invoice ────────────────────────────────────────────────
    const { data: invoice, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(
        `*,
         customers (id, shop_name, owner_name, phone, address),
         orders (
           id, sales_rep_id, status, order_date, notes,
           profiles!orders_sales_rep_id_fkey (full_name)
         )`
      )
      .eq("id", id)
      .single();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select(
        `*, products (id, name, sku, mrp, selling_price, unit_of_measure, supplier_name, brand)`
      )
      .eq("order_id", invoice.order_id);

    const invoiceData = {
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
        supplier:
          item.products?.supplier_name || item.products?.brand || null,
      })),
    };

    // ── 2. Build HTML ───────────────────────────────────────────────────
    const invoiceHtml = await generateInvoiceHTML(
      invoiceData,
      divisionKey,
      origin
    );
    const fullHtml = getDocumentWrapper(
      invoiceHtml,
      invoiceData.invoiceNo || "Invoice"
    );

    // ── 3. Render with Puppeteer (retry once on stale browser) ──────────
    let pdfBuffer: Uint8Array;
    try {
      pdfBuffer = await renderPdf(fullHtml);
    } catch (e: any) {
      if (e?.message?.includes("Connection closed") || e?.message?.includes("Target closed")) {
        pdfBuffer = await renderPdf(fullHtml);
      } else {
        throw e;
      }
    }

    const filename = `${invoiceData.invoiceNo || "Invoice"}.pdf`;

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("PDF generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
