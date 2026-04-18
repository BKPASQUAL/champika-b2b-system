import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const createTargetSchema = z.object({
  user_id: z.string().uuid(),
  target_type: z.string().default('Sales'),
  time_category: z.string().min(1),
  target_amount: z.number().min(0),
  bonus_amount: z.number().min(0),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  business_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const businessId = searchParams.get("business_id");
    const isActive = searchParams.get("is_active");

    let query = supabaseAdmin
      .from("employee_targets")
      .select(`*, profiles:user_id (id, full_name, email)`)
      .order("created_at", { ascending: false });

    if (userId) query = query.eq("user_id", userId);
    if (businessId) query = query.eq("business_id", businessId);
    if (isActive !== null) query = query.eq("is_active", isActive === 'true');

    const { data, error } = await query;
    if (error) {
       // Prevent crash if table does not exist yet while user is testing
       if (error.code === "PGRST205") return NextResponse.json({ targets: [] });
       throw error;
    }

    return NextResponse.json({ targets: data });
  } catch (error: any) {
    console.error("Error fetching targets:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = createTargetSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from("employee_targets")
      .insert({
        user_id: val.user_id,
        target_type: val.target_type,
        time_category: val.time_category,
        target_amount: val.target_amount,
        bonus_amount: val.bonus_amount,
        start_date: val.start_date ?? null,
        end_date: val.end_date ?? null,
        is_active: val.is_active,
        business_id: val.business_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ target: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating target:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
