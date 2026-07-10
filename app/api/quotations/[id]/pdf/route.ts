/**
 * GET /api/quotations/[id]/pdf?division=retail
 *
 * Server-side PDF generation using Puppeteer (headless Chromium).
 * Produces output pixel-identical to the browser print engine.
 */
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  generateQuotationHTML,
} from "@/app/lib/quotation-html";
import { getDocumentWrapper, DIVISIONS } from "@/app/lib/invoice-html";
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
    "retail") as keyof typeof DIVISIONS;

  try {
    // ── 1. Fetch quotation ──────────────────────────────────────────────
    const { data: q, error: qError } = await supabaseAdmin
      .from("quotations")
      .select(`
        *,
        customers (
          id,
          shop_name,
          owner_name,
          phone,
          address
        )
      `)
      .eq("id", id)
      .single();

    if (qError || !q) {
      return new Response(JSON.stringify({ error: "Quotation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch sales rep profile details if salesRepId exists
    let salesRepName = "Unknown";
    if (q.sales_rep_id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", q.sales_rep_id)
        .single();
      salesRepName = profile?.full_name || "Unknown";
    }

    const quotationData = {
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

    // ── 2. Build HTML ───────────────────────────────────────────────────
    const quotationHtml = await generateQuotationHTML(
      quotationData,
      divisionKey,
      origin
    );
    const fullHtml = getDocumentWrapper(
      quotationHtml,
      quotationData.quotationNo || "Quotation"
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

    const filename = `${quotationData.quotationNo || "Quotation"}.pdf`;

    return new Response(pdfBuffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Quotation PDF generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
