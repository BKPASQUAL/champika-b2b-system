import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Returns an active invoice book for the given salesRepId.
 * If the sales rep does NOT have an active book, automatically allocates a 1000-bill range
 * (e.g., 2000-2999 for 1st rep/Direct, 3000-3999 for 2nd rep, 4000-4999 for 3rd rep, etc.)
 */
export async function getOrCreateActiveRepBook(
  salesRepId: string,
  businessId?: string | null
) {
  if (!salesRepId) return null;

  try {
    // 1. Check if rep has an explicit active assigned invoice_book (MANUAL & ASSIGNED PRIORITY)
    const { data: existingActive, error: searchErr } = await supabaseAdmin
      .from("invoice_books")
      .select("*")
      .eq("assigned_to_user_id", salesRepId)
      .eq("status", "Active")
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

    // 2. Fetch rep profile details
    const { data: repProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", salesRepId)
      .single();

    const repName = repProfile?.full_name || repProfile?.email || "Sales Rep";
    const isDirectRep =
      repName.toLowerCase().includes("direct") ||
      repName.toLowerCase().includes("champika hardware");

    // 3. Find highest end_number across all existing invoice_books to determine next available 1000 range
    const { data: allBooks } = await supabaseAdmin
      .from("invoice_books")
      .select("start_number, end_number");

    let maxEndNum = 1999; // Default starting boundary (so initial range is 2000 - 2999)
    let has2000Block = false;

    if (allBooks && allBooks.length > 0) {
      for (const b of allBooks) {
        if (b.start_number === 2000 || (b.start_number <= 2000 && b.end_number >= 2999)) {
          has2000Block = true;
        }
        if (b.end_number && Number(b.end_number) > maxEndNum) {
          maxEndNum = Number(b.end_number);
        }
      }
    }

    // Calculate next 1000-block range start
    let nextStart = Math.max(2000, Math.floor(maxEndNum / 1000) * 1000 + 1000);

    // If Direct Rep is creating and range 2000-2999 is free, prioritize 2000 for Direct Rep
    if (isDirectRep && !has2000Block) {
      nextStart = 2000;
    }

    const nextEnd = nextStart + 999;
    const bookNumber = isDirectRep ? "DIR-AUTO" : `AUTO-${nextStart}`;
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
        business_id: businessId || null,
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
