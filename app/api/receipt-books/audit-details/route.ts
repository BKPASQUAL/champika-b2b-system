import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");
    const customStart = searchParams.get("startNumber");
    const customEnd = searchParams.get("endNumber");

    let book: any = null;
    let startNo: number = 0;
    let endNo: number = 0;

    if (bookId) {
      const { data: bData, error: bErr } = await supabaseAdmin
        .from("receipt_books")
        .select("*")
        .eq("id", bookId)
        .single();

      if (bErr || !bData) {
        return NextResponse.json({ error: "Receipt book not found" }, { status: 404 });
      }
      book = bData;
      startNo = Number(bData.start_number);
      endNo = Number(bData.end_number);
    } else if (customStart && customEnd) {
      startNo = Number(customStart);
      endNo = Number(customEnd);
      book = {
        id: "custom",
        book_number: `Custom Range (${startNo} - ${endNo})`,
        start_number: startNo,
        end_number: endNo,
        current_number: startNo,
        assigned_to_user_name: searchParams.get("ownerName") || "Specified Range",
        status: "Active",
      };
    } else {
      return NextResponse.json({ error: "Book ID or start/end range parameters are required" }, { status: 400 });
    }

    if (startNo > endNo || endNo - startNo > 2000) {
      return NextResponse.json({ error: "Invalid range limits (max 2000 items per audit scan)" }, { status: 400 });
    }

    // Fetch payments matching receipt_book_id OR receipt_number in range
    let paymentsQuery = supabaseAdmin
      .from("payments")
      .select(`
        id,
        amount,
        payment_date,
        method,
        receipt_number,
        receipt_book_id,
        is_cancelled,
        customers (
          shop_name
        ),
        invoices (
          invoice_no
        )
      `);

    if (bookId && bookId !== "custom") {
      paymentsQuery = paymentsQuery.or(`receipt_book_id.eq.${bookId},and(receipt_number.gte.${startNo},receipt_number.lte.${endNo})`);
    } else {
      paymentsQuery = paymentsQuery.gte("receipt_number", String(startNo)).lte("receipt_number", String(endNo));
    }

    const { data: payments, error: pErr } = await paymentsQuery;
    if (pErr) {
      console.error("Audit payments query error:", pErr);
    }

    // Group payments by receipt number (allows multiple invoice settlements per receipt)
    const paymentMap: Record<string, any[]> = {};
    (payments || []).forEach((p: any) => {
      if (p.receipt_number) {
        const key = String(p.receipt_number).trim();
        if (!paymentMap[key]) paymentMap[key] = [];
        paymentMap[key].push(p);
      }
    });

    // Generate itemized receipt-number-by-receipt-number breakdown
    const items = [];
    let issuedCount = 0;
    let unusedCount = 0;
    let cancelledCount = 0;
    let totalCollected = 0;

    for (let r = startNo; r <= endNo; r++) {
      const rStr = String(r);
      const matchedList = paymentMap[rStr] || [];

      if (matchedList.length > 0) {
        const isCancelled = matchedList.every((p) => p.is_cancelled);
        const totalReceiptAmount = matchedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const invoiceNos = Array.from(
          new Set(matchedList.map((p) => p.invoices?.invoice_no).filter(Boolean))
        );

        const invoicesList = matchedList.map((p) => ({
          paymentId: p.id,
          invoiceNo: p.invoices?.invoice_no || "N/A",
          amount: Number(p.amount) || 0,
        }));

        const customerName = matchedList[0]?.customers?.shop_name || "Unknown";
        const paymentDate = matchedList[0]?.payment_date || null;
        const method = matchedList[0]?.method || "N/A";

        if (isCancelled) {
          cancelledCount++;
          items.push({
            receiptNumber: rStr,
            status: "Cancelled",
            paymentDate,
            invoiceNo: invoiceNos.join(", "),
            invoicesList,
            invoiceCount: invoicesList.length,
            customerName,
            amount: totalReceiptAmount,
            method,
          });
        } else {
          issuedCount++;
          totalCollected += totalReceiptAmount;
          items.push({
            receiptNumber: rStr,
            status: "Issued",
            paymentDate,
            invoiceNo: invoiceNos.join(", "),
            invoicesList,
            invoiceCount: invoicesList.length,
            customerName,
            amount: totalReceiptAmount,
            method,
          });
        }
      } else {
        unusedCount++;
        items.push({
          receiptNumber: rStr,
          status: "Unused",
          paymentDate: null,
          invoiceNo: null,
          invoicesList: [],
          invoiceCount: 0,
          customerName: null,
          amount: null,
          method: null,
        });
      }
    }

    return NextResponse.json({
      book,
      summary: {
        totalReceipts: endNo - startNo + 1,
        issuedCount,
        unusedCount,
        cancelledCount,
        totalCollected,
      },
      items,
    });
  } catch (error: any) {
    console.error("Receipt book audit detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
