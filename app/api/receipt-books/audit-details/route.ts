import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookId = searchParams.get("bookId");
    const customStart = searchParams.get("startNumber") || searchParams.get("start");
    const customEnd = searchParams.get("endNumber") || searchParams.get("end");
    const prefix = (searchParams.get("prefix") || "").trim();

    let book: any = null;
    let startNo: number = 0;
    let endNo: number = 0;

    if (bookId && bookId !== "custom") {
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
    } else if (customStart) {
      startNo = parseInt(customStart, 10);
      if (isNaN(startNo) || startNo < 1) startNo = 1001;
      
      if (customEnd) {
        endNo = parseInt(customEnd, 10);
        if (isNaN(endNo) || endNo < startNo) endNo = startNo + 49;
      } else {
        endNo = startNo + 49; // Default 50-receipt book
      }

      book = {
        id: "custom",
        book_number: `Book #${startNo}–#${endNo}`,
        start_number: startNo,
        end_number: endNo,
        current_number: startNo,
        assigned_to_user_name: searchParams.get("ownerName") || "Specified Range",
        status: "Active",
      };
    } else {
      // Default to 1001-1050
      startNo = 1001;
      endNo = 1050;
      book = {
        id: "custom",
        book_number: "Book #1001–#1050",
        start_number: startNo,
        end_number: endNo,
        current_number: startNo,
        assigned_to_user_name: "Default Book",
        status: "Active",
      };
    }

    if (startNo > endNo || endNo - startNo > 2000) {
      return NextResponse.json({ error: "Invalid range limits (max 2000 items per audit scan)" }, { status: 400 });
    }

    // 1. Fetch payments matching receipt_book_id OR receipt_number in range
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
          id,
          invoice_no
        )
      `);

    if (bookId && bookId !== "custom") {
      paymentsQuery = paymentsQuery.or(`receipt_book_id.eq.${bookId},and(receipt_number.gte.${startNo},receipt_number.lte.${endNo})`);
    } else {
      paymentsQuery = paymentsQuery.gte("receipt_number", String(startNo)).lte("receipt_number", String(endNo));
    }

    const [paymentsRes, auditLogsRes, allBooksRes] = await Promise.all([
      paymentsQuery,
      supabaseAdmin
        .from("receipt_book_audits")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("receipt_books")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const payments: any[] = paymentsRes.data || [];
    const auditLogs: any[] = auditLogsRes.data || [];
    const allBooks: any[] = allBooksRes.data || [];

    // 2. Map latest audit check & flag state per receipt number from audit logs
    const auditStatusMap = new Map<string, { isAudited: boolean; isIncorrect: boolean; auditedAt?: string; auditedBy?: string }>();
    
    // Process from oldest to newest so newest overwrites
    [...auditLogs].reverse().forEach((log) => {
      if (log.receipt_number) {
        const rNo = String(log.receipt_number).trim();
        const current = auditStatusMap.get(rNo) || { isAudited: false, isIncorrect: false };
        const notes = String(log.notes || "");

        if (notes.includes("AUDITED:TRUE")) {
          current.isAudited = true;
          current.auditedAt = log.created_at;
          current.auditedBy = log.performed_by_name;
        } else if (notes.includes("AUDITED:FALSE")) {
          current.isAudited = false;
        }

        if (notes.includes("FLAGGED:TRUE")) {
          current.isIncorrect = true;
        } else if (notes.includes("FLAGGED:FALSE")) {
          current.isIncorrect = false;
        }

        auditStatusMap.set(rNo, current);
      }
    });

    // 3. Group payments by receipt number
    const paymentMap: Record<string, any[]> = {};
    payments.forEach((p: any) => {
      if (p.receipt_number) {
        const key = String(p.receipt_number).trim();
        if (!paymentMap[key]) paymentMap[key] = [];
        paymentMap[key].push(p);
      }
    });

    // 4. Generate itemized receipt-number-by-receipt-number breakdown
    const items = [];
    let issuedCount = 0;
    let unusedCount = 0;
    let cancelledCount = 0;
    let totalCollected = 0;
    let auditedCount = 0;
    let flaggedCount = 0;
    const missingNumbers: (string | number)[] = [];

    for (let r = startNo; r <= endNo; r++) {
      const rStr = prefix ? `${prefix}${r}` : String(r);
      const pureNumStr = String(r);
      const matchedList = paymentMap[rStr] || paymentMap[pureNumStr] || [];
      const auditMeta = auditStatusMap.get(rStr) || auditStatusMap.get(pureNumStr) || { isAudited: false, isIncorrect: false };

      if (auditMeta.isAudited) auditedCount++;
      if (auditMeta.isIncorrect) flaggedCount++;

      if (matchedList.length > 0) {
        const isCancelled = matchedList.every((p) => p.is_cancelled);
        const totalReceiptAmount = matchedList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const invoiceNos = Array.from(
          new Set(matchedList.map((p) => p.invoices?.invoice_no).filter(Boolean))
        );

        const invoicesList = matchedList.map((p) => ({
          paymentId: p.id,
          invoiceId: p.invoices?.id || null,
          invoiceNo: p.invoices?.invoice_no || "N/A",
          amount: Number(p.amount) || 0,
        }));

        const customerName = matchedList[0]?.customers?.shop_name || "Unknown Customer";
        const paymentDate = matchedList[0]?.payment_date || null;
        const method = matchedList[0]?.method || "N/A";

        if (isCancelled) {
          cancelledCount++;
          items.push({
            receiptNumber: rStr,
            numericReceiptNo: r,
            status: "Cancelled",
            isEntered: true,
            isAudited: auditMeta.isAudited,
            isIncorrect: auditMeta.isIncorrect,
            auditedAt: auditMeta.auditedAt,
            auditedBy: auditMeta.auditedBy,
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
            numericReceiptNo: r,
            status: "Issued",
            isEntered: true,
            isAudited: auditMeta.isAudited,
            isIncorrect: auditMeta.isIncorrect,
            auditedAt: auditMeta.auditedAt,
            auditedBy: auditMeta.auditedBy,
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
        missingNumbers.push(rStr);
        items.push({
          receiptNumber: rStr,
          numericReceiptNo: r,
          status: "Unused",
          isEntered: false,
          isAudited: auditMeta.isAudited,
          isIncorrect: auditMeta.isIncorrect,
          auditedAt: auditMeta.auditedAt,
          auditedBy: auditMeta.auditedBy,
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

    const totalReceipts = endNo - startNo + 1;
    const enteredPercentage = totalReceipts > 0 ? Math.round((issuedCount / totalReceipts) * 100) : 0;
    const pendingAuditCount = Math.max(0, issuedCount - auditedCount);

    // 5. Extract top 5 recent assigned books
    const recentBooks = allBooks.slice(0, 5).map((b) => ({
      id: b.id,
      label: `Book #${b.book_number} (${b.start_number} - ${b.end_number})`,
      bookNumber: b.book_number,
      assignedTo: b.assigned_to_user_name,
      start: Number(b.start_number),
      end: Number(b.end_number),
    }));

    return NextResponse.json({
      book,
      recentBooks,
      summary: {
        startNum: startNo,
        endNum: endNo,
        prefix,
        totalReceipts,
        issuedCount,
        unusedCount,
        cancelledCount,
        auditedCount,
        pendingAuditCount,
        flaggedCount,
        enteredPercentage,
        totalCollected,
        missingNumbers,
      },
      items,
    });
  } catch (error: any) {
    console.error("Receipt book audit detail error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      receiptNumber,
      receiptBookId,
      isAudited,
      isIncorrect,
      performedByName = "Office Staff",
      performedByEmail,
    } = body;

    if (!receiptNumber) {
      return NextResponse.json({ error: "receiptNumber is required" }, { status: 400 });
    }

    const cleanReceiptNo = String(receiptNumber).trim();
    let noteTag = "";

    if (typeof isAudited === "boolean") {
      noteTag = isAudited ? `AUDITED:TRUE - Marked audited by ${performedByName}` : `AUDITED:FALSE - Audit mark removed by ${performedByName}`;
    } else if (typeof isIncorrect === "boolean") {
      noteTag = isIncorrect ? `FLAGGED:TRUE - Flagged for audit check by ${performedByName}` : `FLAGGED:FALSE - Audit flag removed by ${performedByName}`;
    } else {
      return NextResponse.json({ error: "Either isAudited or isIncorrect boolean must be provided" }, { status: 400 });
    }

    const { data: auditEntry, error: auditErr } = await supabaseAdmin
      .from("receipt_book_audits")
      .insert({
        action_type: "EDITED",
        receipt_book_id: receiptBookId || null,
        receipt_number: cleanReceiptNo,
        performed_by_name: performedByName,
        performed_by_email: performedByEmail || null,
        notes: noteTag,
      })
      .select()
      .single();

    if (auditErr) {
      console.error("Failed to insert receipt audit entry:", auditErr);
      return NextResponse.json({ error: auditErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      receiptNumber: cleanReceiptNo,
      isAudited,
      isIncorrect,
      auditEntry,
    });
  } catch (error: any) {
    console.error("Toggle receipt audit error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
