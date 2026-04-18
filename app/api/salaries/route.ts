import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const createSalarySchema = z.object({
  user_id: z.string().uuid(),
  basic_salary: z.number().default(0),
  auto_commissions: z.number().default(0),
  manual_commissions_added: z.number().default(0),
  manual_commissions_deducted: z.number().default(0),
  target_bonus_amount: z.number().default(0),
  other_deductions: z.number().default(0),
  // New fields
  lunch_allowance: z.number().default(0),
  working_days: z.number().int().default(0),
  night_out_days: z.number().int().default(0),
  night_out_allowance: z.number().default(0),
  payment_date: z.string().optional(),
  salary_month: z.string().optional(),
  business_id: z.string().uuid().optional().nullable(),
  recorded_by: z.string().uuid().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const businessId = searchParams.get("business_id");
    const status = searchParams.get("admin_approval_status");
    const month = searchParams.get("salary_month");

    let query = supabaseAdmin
      .from("salaries")
      .select(`*, profiles:user_id (id, full_name, email)`)
      .order("created_at", { ascending: false });

    if (userId) query = query.eq("user_id", userId);
    if (businessId) query = query.eq("business_id", businessId);
    if (status) query = query.eq("admin_approval_status", status);
    if (month) query = query.eq("salary_month", month);

    const { data, error } = await query;
    if (error) {
       if (error.code === "PGRST205") return NextResponse.json({ salaries: [] });
       throw error;
    }

    return NextResponse.json({ salaries: data });
  } catch (error: any) {
    console.error("Error fetching salaries:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const val = createSalarySchema.parse(body);

    // Calculate net automatically
    const net_salary =
      (val.basic_salary + val.auto_commissions + val.manual_commissions_added +
       val.target_bonus_amount + val.lunch_allowance + val.night_out_allowance) -
      (val.manual_commissions_deducted + val.other_deductions);

    const { data, error } = await supabaseAdmin
      .from("salaries")
      .insert({
        user_id: val.user_id,
        basic_salary: val.basic_salary,
        auto_commissions: val.auto_commissions,
        manual_commissions_added: val.manual_commissions_added,
        manual_commissions_deducted: val.manual_commissions_deducted,
        target_bonus_amount: val.target_bonus_amount,
        other_deductions: val.other_deductions,
        lunch_allowance: val.lunch_allowance,
        working_days: val.working_days,
        night_out_days: val.night_out_days,
        night_out_allowance: val.night_out_allowance,
        net_salary,
        payment_date: val.payment_date || new Date().toISOString().split('T')[0],
        salary_month: val.salary_month || null,
        admin_approval_status: 'Pending',
        business_id: val.business_id || null,
        recorded_by: val.recorded_by || null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ salary: data }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error creating salary record:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
