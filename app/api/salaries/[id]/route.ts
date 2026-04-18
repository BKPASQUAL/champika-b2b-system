import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { z } from "zod";

const updateStatusSchema = z.object({
  admin_approval_status: z.enum(["Pending", "Approved", "Rejected"]),
  approved_by: z.string().uuid().optional(),
});

const updateSalarySchema = z.object({
  basic_salary: z.number().optional(),
  auto_commissions: z.number().optional(),
  manual_commissions_added: z.number().optional(),
  manual_commissions_deducted: z.number().optional(),
  target_bonus_amount: z.number().optional(),
  other_deductions: z.number().optional(),
  lunch_allowance: z.number().optional(),
  working_days: z.number().int().optional(),
  night_out_days: z.number().int().optional(),
  night_out_allowance: z.number().optional(),
  payment_date: z.string().optional(),
  salary_month: z.string().optional(),
});

/** PATCH — change approval status only */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await request.json();
    const val = updateStatusSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from("salaries")
      .update({
        admin_approval_status: val.admin_approval_status,
        approved_by: val.approved_by || null,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ salary: data }, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating salary status:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PUT — full salary edit (re-calculates net) */
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const body = await request.json();
    const val = updateSalarySchema.parse(body);

    // Fetch existing record to use as fallback values for calculation
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("salaries")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;

    const basicSalary = val.basic_salary ?? existing.basic_salary ?? 0;
    const autoComm = val.auto_commissions ?? existing.auto_commissions ?? 0;
    const manualAdd = val.manual_commissions_added ?? existing.manual_commissions_added ?? 0;
    const manualDeduct = val.manual_commissions_deducted ?? existing.manual_commissions_deducted ?? 0;
    const targetBonus = val.target_bonus_amount ?? existing.target_bonus_amount ?? 0;
    const otherDed = val.other_deductions ?? existing.other_deductions ?? 0;
    const lunchAllow = val.lunch_allowance ?? existing.lunch_allowance ?? 0;
    const nightAllw = val.night_out_allowance ?? existing.night_out_allowance ?? 0;

    const net_salary =
      (basicSalary + autoComm + manualAdd + targetBonus + lunchAllow + nightAllw) -
      (manualDeduct + otherDed);

    const updatePayload: Record<string, any> = {
      basic_salary: basicSalary,
      auto_commissions: autoComm,
      manual_commissions_added: manualAdd,
      manual_commissions_deducted: manualDeduct,
      target_bonus_amount: targetBonus,
      other_deductions: otherDed,
      lunch_allowance: lunchAllow,
      night_out_allowance: nightAllw,
      net_salary,
      // reset to Pending when edited so admin re-approves
      admin_approval_status: "Pending",
      approved_by: null,
      approved_at: null,
      updated_at: new Date().toISOString(),
    };

    if (val.working_days !== undefined) updatePayload.working_days = val.working_days;
    if (val.night_out_days !== undefined) updatePayload.night_out_days = val.night_out_days;
    if (val.payment_date !== undefined) updatePayload.payment_date = val.payment_date;
    if (val.salary_month !== undefined) updatePayload.salary_month = val.salary_month;

    const { data, error } = await supabaseAdmin
      .from("salaries")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ salary: data }, { status: 200 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Error updating salary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** DELETE — remove a salary record */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = params.id;
    if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("salaries")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting salary:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
