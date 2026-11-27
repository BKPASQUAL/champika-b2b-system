import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Supabase Auth "Send SMS" hook → Notify.lk (Sri Lankan SMS gateway).
 *
 * Supabase calls this when a shop customer asks for a phone login code
 * (signInWithOtp({ phone })). We check the request really came from Supabase
 * (Standard Webhooks signature), then send the code by SMS.
 *
 * Setup (owner):
 *  1. Notify.lk account + approved sender ID.
 *  2. Env vars: NOTIFY_LK_USER_ID, NOTIFY_LK_API_KEY, NOTIFY_LK_SENDER_ID,
 *     SMS_HOOK_SECRET (the "v1,whsec_…" secret Supabase shows for the hook).
 *  3. Supabase → Authentication → Sign In / Providers → Phone: enable.
 *     Authentication → Hooks → Send SMS hook: HTTPS, URL = <B2B domain>/api/storefront/sms-hook.
 */

const MAX_AGE_SECONDS = 5 * 60;

function verifySignature(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > MAX_AGE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // Header: space-separated "v1,<base64>" entries.
  return signatures.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

const hookError = (message: string, status = 500) =>
  NextResponse.json({ error: { http_code: status, message } }, { status });

export async function POST(request: NextRequest) {
  const secret = process.env.SMS_HOOK_SECRET;
  const userId = process.env.NOTIFY_LK_USER_ID;
  const apiKey = process.env.NOTIFY_LK_API_KEY;
  const senderId = process.env.NOTIFY_LK_SENDER_ID;
  if (!secret || !userId || !apiKey || !senderId) return hookError("SMS sending is not set up yet.");

  const body = await request.text();
  if (!verifySignature(body, request.headers, secret)) return hookError("Invalid signature", 401);

  let payload: { user?: { phone?: string }; sms?: { otp?: string } };
  try {
    payload = JSON.parse(body);
  } catch {
    return hookError("Bad request", 400);
  }
  const phone = String(payload.user?.phone || "").replace(/\D/g, ""); // Notify.lk wants 94XXXXXXXXX
  const otp = String(payload.sms?.otp || "");
  if (!/^94\d{9}$/.test(phone) || !/^\d{4,10}$/.test(otp)) return hookError("Bad phone number or code", 400);

  const params = new URLSearchParams({
    user_id: userId,
    api_key: apiKey,
    sender_id: senderId,
    to: phone,
    message: `Your login code is ${otp}. It expires in a few minutes. Do not share this code with anyone.`,
  });
  try {
    const res = await fetch("https://app.notify.lk/api/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; data?: unknown };
    if (!res.ok || json.status !== "success") {
      console.error("[sms-hook] Notify.lk failed", res.status, json);
      return hookError("Could not send the SMS. Please try again.");
    }
  } catch (e) {
    console.error("[sms-hook] Notify.lk unreachable", e);
    return hookError("Could not send the SMS. Please try again.");
  }
  return NextResponse.json({});
}
