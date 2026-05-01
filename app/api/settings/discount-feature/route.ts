import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SETTING_KEY = "allow_discount_feature";

const defaultValue = { wireman: false, sierra: false, orange: false, distribution: false };

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .single();

    if (error) return NextResponse.json(defaultValue);

    return NextResponse.json({ ...defaultValue, ...(data?.value ?? {}) });
  } catch {
    return NextResponse.json(defaultValue);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Fetch current value and merge partial update
    const { data: current } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .single();

    const merged = { ...defaultValue, ...(current?.value ?? {}), ...body };

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: SETTING_KEY, value: merged, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (error) throw error;

    return NextResponse.json({ success: true, ...merged });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
