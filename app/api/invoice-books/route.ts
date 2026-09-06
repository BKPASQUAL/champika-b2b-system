import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";
import { BUSINESS_IDS } from "@/app/config/business-constants";

const createInvoiceBookSchema = z.object({
  bookNumber: z.string().min(1, "Book number is required"),
  prefix: z.string().default("CHD"),
  startNumber: z.number().int().min(1, "Start number must be positive"),
  endNumber: z.number().int().min(1, "End number must be positive"),
  assignedToUserId: z.string().min(1, "Assigned user is required"),
  businessId: z.string().optional().nullable(),
  performedByName: z.string().optional().nullable(),
  performedByEmail: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET: Fetch invoice books
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const businessId = searchParams.get("businessId");
    const search = searchParams.get("search");

    let query = supabaseAdmin
      .from("invoice_books")
      .select("*")
      .order("created_at", { ascending: false });

    if (userId) {
      query = query.eq("assigned_to_user_id", userId);
    }
    if (status) {
      query = query.eq("status", status);
    }
    if (businessId) {
      query = query.eq("business_id", businessId);
    }
    if (search) {
      query = query.or(`book_number.ilike.%${search}%,assigned_to_user_name.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Error fetching invoice books:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create and assign a new invoice book
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = createInvoiceBookSchema.parse(body);

    if (val.startNumber > val.endNumber) {
      return NextResponse.json(
        { error: "Start number cannot be greater than end number" },
        { status: 400 }
      );
    }

    // Fetch assigned user profile details
    const { data: userProfile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", val.assignedToUserId)
      .single();

    if (profileErr || !userProfile) {
      return NextResponse.json({ error: "Assigned user profile not found" }, { status: 404 });
    }

    const userName = userProfile.full_name || userProfile.email || "Unknown User";

    // Insert into invoice_books
    const { data: newBook, error: insertErr } = await supabaseAdmin
      .from("invoice_books")
      .insert({
        book_number: val.bookNumber,
        prefix: val.prefix || "CHD",
        start_number: val.startNumber,
        end_number: val.endNumber,
        current_number: val.startNumber,
        assigned_to_user_id: userProfile.id,
        assigned_to_user_name: userName,
        business_id: val.businessId || BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
        status: "Active",
        created_by_name: val.performedByName || "Admin",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Log Audit Record if table exists
    try {
      await supabaseAdmin.from("invoice_book_audits").insert({
        invoice_book_id: newBook.id,
        action_type: "ASSIGNED",
        book_number: val.bookNumber,
        start_number_new: val.startNumber,
        end_number_new: val.endNumber,
        assigned_to_new_id: userProfile.id,
        assigned_to_new_name: userName,
        performed_by_name: val.performedByName || "Admin",
        performed_by_email: val.performedByEmail || null,
        notes: val.notes || `Invoice book #${val.bookNumber} assigned to ${userName} (Range: ${val.prefix}-${val.startNumber} to ${val.prefix}-${val.endNumber})`,
      });
    } catch (e: any) {
      console.log("Audit log optional fail:", e.message);
    }

    return NextResponse.json(newBook, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating invoice book:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
