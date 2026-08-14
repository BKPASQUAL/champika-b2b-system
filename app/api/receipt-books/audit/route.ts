import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionType = searchParams.get("actionType");
    const bookNumber = searchParams.get("bookNumber");
    const search = searchParams.get("search");
    const role = searchParams.get("role"); // Optional role pass-through from client context

    // Strictly enforce Admin restriction
    // If role is passed and not admin, reject. Or caller must be accessing via admin portal
    if (role && role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Access denied: Audit log is restricted to Admins only" }, { status: 403 });
    }

    let query = supabaseAdmin
      .from("receipt_book_audits")
      .select("*")
      .order("created_at", { ascending: false });

    if (actionType) {
      query = query.eq("action_type", actionType);
    }
    if (bookNumber) {
      query = query.eq("book_number", bookNumber);
    }
    if (search) {
      query = query.or(
        `book_number.ilike.%${search}%,assigned_to_new_name.ilike.%${search}%,performed_by_name.ilike.%${search}%,receipt_number.ilike.%${search}%,notes.ilike.%${search}%`
      );
    }

    const { data, error } = await query.limit(500);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error fetching receipt book audit log:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
