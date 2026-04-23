import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const createSchema = z.object({
  portal: z.string().min(1),
  business_id: z.string().uuid().optional().nullable(),
  business_name: z.string().optional().nullable(),
  action_type: z.string().min(1),
  record_type: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().uuid().optional().nullable(),
  entity_no: z.string().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  performed_by_id: z.string().uuid().optional().nullable(),
  performed_by_name: z.string().optional().nullable(),
  performed_by_email: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/activity-records — list all records (admin use)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portal = searchParams.get("portal");
    const actionType = searchParams.get("action_type");
    const businessId = searchParams.get("business_id");
    const limit = parseInt(searchParams.get("limit") ?? "100");
    const offset = parseInt(searchParams.get("offset") ?? "0");

    let query = supabaseAdmin
      .from("activity_records")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (portal) query = query.eq("portal", portal);
    if (actionType) query = query.eq("action_type", actionType);
    if (businessId) query = query.eq("business_id", businessId);

    const { data, error, count } = await query;

    // Detect "table does not exist" specifically so the UI can show a setup screen
    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("activity_records")) {
        return NextResponse.json({ setup_required: true, records: [], total: 0 }, { status: 200 });
      }
      throw error;
    }

    return NextResponse.json({ records: data ?? [], total: count ?? 0 });
  } catch (error: any) {
    console.error("Error fetching activity records:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/activity-records — create a new record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = createSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from("activity_records")
      .insert({
        portal: val.portal,
        business_id: val.business_id ?? null,
        business_name: val.business_name ?? null,
        action_type: val.action_type,
        record_type: val.record_type,
        entity_type: val.entity_type,
        entity_id: val.entity_id ?? null,
        entity_no: val.entity_no ?? null,
        customer_id: val.customer_id ?? null,
        customer_name: val.customer_name ?? null,
        amount: val.amount ?? null,
        performed_by_id: val.performed_by_id ?? null,
        performed_by_name: val.performed_by_name ?? null,
        performed_by_email: val.performed_by_email ?? null,
        metadata: val.metadata ?? null,
        notes: val.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ record: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating activity record:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
