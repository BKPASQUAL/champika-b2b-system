import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

/**
 * Returns an active invoice book for the given salesRepId.
 * If the sales rep does NOT have an active book, automatically allocates a 1000-bill range
 * (e.g., 2000-2999, 3000-3999, 4000-4999, etc.) ONLY for actual field sales reps (role === 'rep').
 *
 * NOTE: 
 * - Invoice books strictly apply ONLY to field sales reps in the Champika Distribution portal.
 * - Direct Bills (Champika Hardware - Direct), office users, admins, and other business portals 
 *   (CHR, OR, SI, WI) MUST NOT use or auto-allocate invoice books.
 */
export async function getOrCreateActiveRepBook(
  salesRepId?: string | null,
  businessId?: string | null
) {
  if (!salesRepId) return null;

  // Invoice books strictly apply ONLY to Champika Distribution portal
  if (businessId && businessId !== BUSINESS_IDS.CHAMPIKA_DISTRIBUTION) {
    return null;
  }

  try {
    // 1. Check if rep has an explicit active assigned invoice_book (MANUAL & ASSIGNED PRIORITY)
    let bookQuery = supabaseAdmin
      .from("invoice_books")
      .select("*")
      .eq("assigned_to_user_id", salesRepId)
      .eq("status", "Active");

    if (businessId) {
      bookQuery = bookQuery.eq("business_id", businessId);
    }

    const { data: existingActive, error: searchErr } = await bookQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      !searchErr &&
      existingActive &&
      Number(existingActive.current_number) <= Number(existingActive.end_number)
    ) {
      return existingActive;
    }

    // 2. Fetch rep profile details to ensure this is an actual field sales rep
    const { data: repProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", salesRepId)
      .single();

    if (!repProfile) return null;

    // STRICT CHECK: Only actual field sales reps (role === 'rep') can have auto-allocated books!
    // Office workers, admins, delivery drivers, etc. MUST NOT be auto-allocated invoice books.
    if (repProfile.role !== "rep") {
      return null;
    }

    const repName = repProfile.full_name || repProfile.email || "Sales Rep";
    const isDirectRep =
      repName.toLowerCase().includes("direct") ||
      repName.toLowerCase().includes("champika hardware");

    // Direct Rep uses standard continuous sequence (CHD-0001, CHD-0060, CHD-0061...)
    if (isDirectRep) {
      return null;
    }

    // 3. Find highest end_number across all existing invoice_books to determine next available 1000 range
    const { data: allBooks } = await supabaseAdmin
      .from("invoice_books")
      .select("start_number, end_number");

    let maxEndNum = 1999; // Default starting boundary (so initial range for reps is 2000 - 2999)

    if (allBooks && allBooks.length > 0) {
      for (const b of allBooks) {
        if (b.end_number && Number(b.end_number) > maxEndNum) {
          maxEndNum = Number(b.end_number);
        }
      }
    }

    // Calculate next 1000-block range start
    const nextStart = Math.max(2000, Math.floor(maxEndNum / 1000) * 1000 + 1000);
    const nextEnd = nextStart + 999;
    const bookNumber = `AUTO-${nextStart}`;
    const prefix = "CHD";

    // 4. Create and insert new active 1000-bill range book
    const { data: newBook, error: insertErr } = await supabaseAdmin
      .from("invoice_books")
      .insert({
        book_number: bookNumber,
        prefix: prefix,
        start_number: nextStart,
        end_number: nextEnd,
        current_number: nextStart,
        assigned_to_user_id: salesRepId,
        assigned_to_user_name: repName,
        business_id: businessId || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
        status: "Active",
        created_by_name: "Auto-Allocator",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Error auto-allocating invoice book range:", insertErr.message);
      return null;
    }

    return newBook;
  } catch (error: any) {
    console.error("Exception in getOrCreateActiveRepBook:", error.message);
    return null;
  }
}

/**
 * Returns the next generated invoice number for a given business and optional sales rep.
 */
export async function getNextInvoiceNumber(
  businessId?: string | null,
  salesRepId?: string | null,
  offset = 0
): Promise<{ invoiceNo: string; isFromRepBook: boolean; bookId?: string }> {
  const INVOICE_PREFIXES: Record<string, string> = {
    [BUSINESS_IDS.CHAMPIKA_DISTRIBUTION]: "CHD",
    [BUSINESS_IDS.CHAMPIKA_RETAIL]:       "CHR",
    [BUSINESS_IDS.ORANGE_AGENCY]:         "OR",
    [BUSINESS_IDS.SIERRA_AGENCY]:         "SI",
    [BUSINESS_IDS.WIREMAN_AGENCY]:        "WI",
  };

  const resolvedBusinessId = businessId || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;
  const prefix = INVOICE_PREFIXES[resolvedBusinessId] ?? "INV";
  const isDistribution = resolvedBusinessId === BUSINESS_IDS.CHAMPIKA_DISTRIBUTION;

  // Invoice Books strictly apply ONLY to Champika Distribution portal with an active sales rep
  let activeRepBook: any = null;
  if (isDistribution && salesRepId) {
    activeRepBook = await getOrCreateActiveRepBook(salesRepId, resolvedBusinessId);
  }

  if (isDistribution && activeRepBook) {
    const nextNum = Number(activeRepBook.current_number) + offset;
    const bPrefix = activeRepBook.prefix || prefix;
    return {
      invoiceNo: `${bPrefix}-${String(nextNum).padStart(4, "0")}`,
      isFromRepBook: true,
      bookId: activeRepBook.id,
    };
  }

  const [createdRes, noRes] = await Promise.all([
    supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .ilike("invoice_no", `${prefix}-%`)
      .order("created_at", { ascending: false })
      .limit(500),
    supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .ilike("invoice_no", `${prefix}-%`)
      .order("invoice_no", { ascending: false })
      .limit(500),
  ]);

  const combined = [...(createdRes.data ?? []), ...(noRes.data ?? [])];
  const maxSeq = Math.max(
    0,
    ...combined.map((inv: any) => {
      const parts = ((inv.invoice_no as string) || "").split("-");
      const n = parseInt(parts[parts.length - 1], 10);
      // Continuous sequence excludes rep 1000-block ranges (>= 2000) for Distribution
      if (isNaN(n) || (isDistribution && n >= 2000)) return 0;
      return n;
    })
  );

  return {
    invoiceNo: `${prefix}-${String(maxSeq + 1 + offset).padStart(4, "0")}`,
    isFromRepBook: false,
  };
}
