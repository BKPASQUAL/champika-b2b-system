import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startStr = searchParams.get("start") || "101";
    const endStr = searchParams.get("end") || "150";
    const prefix = (searchParams.get("prefix") || "").trim();

    let startNum = parseInt(startStr, 10);
    let endNum = parseInt(endStr, 10);

    if (isNaN(startNum) || startNum < 1) startNum = 101;
    if (isNaN(endNum) || endNum < startNum) endNum = startNum + 49; // Default 50 bills

    // Cap range length at 500 to prevent server overload
    if (endNum - startNum + 1 > 500) {
      endNum = startNum + 499;
    }

    // 1. Fetch Sierra invoices using inner join on customers.business_id
    const { data, error: invError } = await supabaseAdmin
      .from("invoices")
      .select(`
        id,
        invoice_no,
        manual_invoice_no,
        total_amount,
        paid_amount,
        due_amount,
        status,
        is_incorrect,
        is_audited,
        created_at,
        due_date,
        customer_id,
        customers!inner (
          shop_name,
          owner_name,
          business_id
        )
      `)
      .eq("customers.business_id", BUSINESS_IDS.SIERRA_AGENCY)
      .order("created_at", { ascending: false });

    if (invError) throw invError;
    const invoices: any[] = data || [];

    // 2. Build lookup maps for fast matching against manual_invoice_no (and fallback invoice_no)
    const exactLookupMap = new Map<string, any>();
    const numericLookupMap = new Map<number, any>();

    const normalizeStr = (str: string) => str.trim().toLowerCase();

    const extractDigits = (str: string): number | null => {
      const match = str.match(/\d+/);
      if (match) {
        const parsed = parseInt(match[0], 10);
        return isNaN(parsed) ? null : parsed;
      }
      return null;
    };

    invoices.forEach((inv) => {
      const manualNo = inv.manual_invoice_no ? String(inv.manual_invoice_no).trim() : null;
      const sysNo = inv.invoice_no ? String(inv.invoice_no).trim() : null;

      if (manualNo) {
        exactLookupMap.set(normalizeStr(manualNo), inv);
        const digits = extractDigits(manualNo);
        if (digits !== null && !numericLookupMap.has(digits)) {
          numericLookupMap.set(digits, inv);
        }
      }

      if (sysNo) {
        if (!exactLookupMap.has(normalizeStr(sysNo))) {
          exactLookupMap.set(normalizeStr(sysNo), inv);
        }
        const sysDigits = extractDigits(sysNo);
        if (sysDigits !== null && !numericLookupMap.has(sysDigits)) {
          numericLookupMap.set(sysDigits, inv);
        }
      }
    });

    // 3. Build sequence result array for range [startNum ... endNum]
    const bills: any[] = [];
    let totalEnteredAmount = 0;
    const missingNumbers: (string | number)[] = [];

    for (let num = startNum; num <= endNum; num++) {
      const formattedBillNo = prefix ? `${prefix}${num}` : `${num}`;
      
      // Try exact string match first, then prefixed string match, then numeric match
      let matchedInvoice = exactLookupMap.get(normalizeStr(formattedBillNo)) ||
                           exactLookupMap.get(normalizeStr(String(num)));

      if (!matchedInvoice && prefix) {
        matchedInvoice = exactLookupMap.get(normalizeStr(`${prefix}${String(num).padStart(3, '0')}`)) ||
                         exactLookupMap.get(normalizeStr(`${prefix}${String(num).padStart(4, '0')}`));
      }

      if (!matchedInvoice) {
        matchedInvoice = numericLookupMap.get(num);
      }

      const isEntered = !!matchedInvoice;

      if (isEntered && matchedInvoice) {
        totalEnteredAmount += Number(matchedInvoice.total_amount || 0);
      } else {
        missingNumbers.push(formattedBillNo);
      }

      bills.push({
        billNo: num,
        formattedBillNo,
        isEntered,
        invoice: isEntered && matchedInvoice ? {
          id: matchedInvoice.id,
          invoiceNo: matchedInvoice.invoice_no,
          manualInvoiceNo: matchedInvoice.manual_invoice_no || null,
          customerId: matchedInvoice.customer_id,
          customerName: matchedInvoice.customers?.shop_name || matchedInvoice.customers?.owner_name || "Unknown Customer",
          date: matchedInvoice.created_at ? matchedInvoice.created_at.split("T")[0] : "",
          totalAmount: Number(matchedInvoice.total_amount || 0),
          paidAmount: Number(matchedInvoice.paid_amount || 0),
          dueAmount: Number(matchedInvoice.due_amount || 0),
          status: matchedInvoice.status || "Unpaid",
          isIncorrect: matchedInvoice.is_incorrect || false,
          isAudited: matchedInvoice.is_audited || false,
        } : null,
      });
    }

    const totalBills = bills.length;
    const enteredCount = bills.filter((b) => b.isEntered).length;
    const missingCount = totalBills - enteredCount;
    const enteredPercentage = totalBills > 0 ? Math.round((enteredCount / totalBills) * 100) : 0;

    // 4. Calculate top 5 most recently added books from invoices
    const recentBooks: { label: string; start: number; end: number }[] = [];
    const seenBookKeys = new Set<string>();

    for (const inv of invoices) {
      if (recentBooks.length >= 5) break;
      const manualNo = inv.manual_invoice_no;
      if (!manualNo) continue;
      const digits = extractDigits(String(manualNo));
      if (digits !== null && digits > 0) {
        const bStart = Math.floor((digits - 1) / 50) * 50 + 1;
        const bEnd = bStart + 49;
        const key = `${bStart}-${bEnd}`;
        if (!seenBookKeys.has(key)) {
          seenBookKeys.add(key);
          recentBooks.push({
            label: `Book #${bStart}–#${bEnd}`,
            start: bStart,
            end: bEnd,
          });
        }
      }
    }

    return NextResponse.json({
      summary: {
        startNum,
        endNum,
        prefix,
        totalBills,
        enteredCount,
        missingCount,
        enteredPercentage,
        totalEnteredAmount,
        missingNumbers,
      },
      recentBooks,
      bills,
    });
  } catch (error: any) {
    console.error("Manual Invoice Audit API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
