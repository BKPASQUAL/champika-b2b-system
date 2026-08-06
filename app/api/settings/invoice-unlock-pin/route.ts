import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SETTING_KEY = "invoice_unlock_pin";
const DEFAULT_PIN = "889900";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value?.pin) {
      return NextResponse.json({ pin: process.env.INVOICE_UNLOCK_PIN || DEFAULT_PIN });
    }

    return NextResponse.json({ pin: String(data.value.pin) });
  } catch (err) {
    return NextResponse.json({ pin: process.env.INVOICE_UNLOCK_PIN || DEFAULT_PIN });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pin = body.pin ? String(body.pin).trim() : "";

    if (!pin || pin.length < 4) {
      return NextResponse.json({ error: "PIN must be at least 4 digits" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          key: SETTING_KEY,
          value: { pin },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      );

    if (error) {
      console.error("Upsert pin error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, pin, message: "Admin PIN updated successfully!" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
