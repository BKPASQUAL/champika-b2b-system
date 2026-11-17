import { NextRequest, NextResponse } from "next/server";

// Reads a photographed / scanned supplier invoice (e.g. Orel / Orange "SALES INVOICE")
// with Gemini and returns its header, line items and footer discounts as JSON.
// The client matches item codes to products and lets the user review before saving.

export const maxDuration = 60;

const MAX_FILES = 4;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

const responseSchema = {
  type: "OBJECT",
  properties: {
    invoiceNumber: { type: "STRING", nullable: true },
    invoiceDate: { type: "STRING", nullable: true },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          itemCode: { type: "STRING", nullable: true },
          description: { type: "STRING", nullable: true },
          quantity: { type: "NUMBER" },
          unit: { type: "STRING", nullable: true },
          discountPercent: { type: "NUMBER", nullable: true },
          unitPrice: { type: "NUMBER" },
          lineDiscount: { type: "NUMBER", nullable: true },
          netAmount: { type: "NUMBER", nullable: true },
        },
        required: ["quantity", "unitPrice"],
      },
    },
    summary: {
      type: "OBJECT",
      properties: {
        grossAmount: { type: "NUMBER", nullable: true },
        udfDiscount: { type: "NUMBER", nullable: true },
        distributorMargin: { type: "NUMBER", nullable: true },
        cashDiscount: { type: "NUMBER", nullable: true },
        rdDiscount: { type: "NUMBER", nullable: true },
        additionalDiscount: { type: "NUMBER", nullable: true },
        totalAmount: { type: "NUMBER", nullable: true },
      },
    },
  },
  required: ["items"],
};

const PROMPT = `You are reading a supplier SALES INVOICE (Sri Lankan electrical supplier, e.g. ORANGE / Orel Corporation). The images may be photos taken on a phone and may be several pages of the SAME invoice.

Extract:
- invoiceNumber: the "Invoice No" value in the top-right header box (NOT the delivery/order ref, NOT the purchaser TIN).
- invoiceDate: the "Date of Invoice". It is printed as MM/DD/YYYY (e.g. 11/16/2026 = 16 November 2026). Return it as YYYY-MM-DD.
- items: EVERY line in the item table, in order. For each line:
  - itemCode: the ITEM column code exactly as printed (e.g. "190-1580-06-07104"), keep the dashes.
  - description: the DESCRIPTION text.
  - quantity: the QTY number.
  - unit: the UNIT text (e.g. "PC", "REL").
  - discountPercent: the percentage printed in brackets in the UNIT column, e.g. "(22.00 %)" -> 22.
  - unitPrice: the UNIT PRICE number.
  - lineDiscount: the DISCOUNT column number.
  - netAmount: the NET AMOUNT column number.
- summary: the totals block under the table: Gross Amount, UDF Discount, Distributor Margin, Cash Discount, RD Discount, Additional Disc(ount), Total Amount. Use null for any line that is not printed.

Rules:
- Numbers must be plain numbers without thousands separators (96,850.00 -> 96850).
- Do not invent lines. If a page repeats the header, do not duplicate items.
- If a digit is unclear, give your best reading; the user will verify.
Return only JSON.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_INVOICE_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!apiKey || apiKey.trim() === "" || apiKey === "placeholder-key") {
      return NextResponse.json(
        { error: "Invoice scanning is not configured (GEMINI_API_KEY missing)." },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No invoice image uploaded" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Upload at most ${MAX_FILES} pages` }, { status: 400 });
    }
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return NextResponse.json({ error: "Images are too large" }, { status: 400 });
    }

    const imageParts = await Promise.all(
      files.map(async (file) => {
        const mimeType = file.type || "image/jpeg";
        if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") {
          throw new Error(`Unsupported file type: ${mimeType}`);
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        return { inlineData: { mimeType, data: buffer.toString("base64") } };
      }),
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [...imageParts, { text: PROMPT }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema,
            temperature: 0,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini invoice scan error:", response.status, errText);
      return NextResponse.json(
        { error: `AI scan failed (${response.status}). Try a clearer photo.` },
        { status: 502 },
      );
    }

    const resJson = await response.json();
    let text: string = resJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    if (!text) {
      return NextResponse.json({ error: "Could not read the invoice. Try a clearer photo." }, { status: 502 });
    }

    const data = JSON.parse(text);
    const num = (v: unknown) => {
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const items = (Array.isArray(data.items) ? data.items : [])
      .map((it: any) => ({
        itemCode: it.itemCode ? String(it.itemCode).trim() : "",
        description: it.description ? String(it.description).trim() : "",
        quantity: num(it.quantity) ?? 0,
        unit: it.unit ? String(it.unit).trim() : "",
        discountPercent: num(it.discountPercent) ?? 0,
        unitPrice: num(it.unitPrice) ?? 0,
        lineDiscount: num(it.lineDiscount),
        netAmount: num(it.netAmount),
      }))
      .filter((it: any) => it.quantity > 0 || it.unitPrice > 0);

    const s = data.summary || {};
    return NextResponse.json({
      invoiceNumber: data.invoiceNumber ? String(data.invoiceNumber).trim() : "",
      invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(data.invoiceDate || "") ? data.invoiceDate : "",
      items,
      summary: {
        grossAmount: num(s.grossAmount),
        udfDiscount: num(s.udfDiscount),
        distributorMargin: num(s.distributorMargin),
        cashDiscount: num(s.cashDiscount),
        rdDiscount: num(s.rdDiscount),
        additionalDiscount: num(s.additionalDiscount),
        totalAmount: num(s.totalAmount),
      },
    });
  } catch (err: any) {
    console.error("scan-invoice error:", err);
    return NextResponse.json({ error: err.message || "Failed to scan invoice" }, { status: 500 });
  }
}
