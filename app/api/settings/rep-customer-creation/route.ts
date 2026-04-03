import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SETTING_KEY = "allow_rep_customer_creation";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .single();

    if (error) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({ enabled: data?.value?.enabled ?? false });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { enabled } = await request.json();

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: SETTING_KEY, value: { enabled: Boolean(enabled) }, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, enabled: Boolean(enabled) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
