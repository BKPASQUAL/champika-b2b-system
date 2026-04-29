// app/api/notifications/trigger/route.ts
// Called by Vercel cron (daily at 8 AM) or manually to send push notifications
// for due customer cheques and supplier cheques that must be passed today.
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import webpush from "web-push";

const today = () => new Date().toISOString().split("T")[0];

function initVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    process.env.VAPID_PRIVATE_KEY ?? ""
  );
}

async function getDueCustomerCheques(businessId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("payments")
    .select("id, cheque_date, cheque_status, payment_method")
    .eq("business_id", businessId)
    .eq("payment_method", "cheque")
    .eq("cheque_status", "Pending")
    .lte("cheque_date", today());

  return data?.length ?? 0;
}

async function getDueSupplierCheques(businessId: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("supplier_payments")
    .select("id, cheque_date, cheque_status, payment_method, purchases!inner(business_id)")
    .eq("payment_method", "cheque")
    .eq("cheque_status", "pending")
    .eq("cheque_date", today())
    .eq("purchases.business_id", businessId);

  return data?.length ?? 0;
}

export async function POST(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initVapid();
  try {
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0, message: "No subscribers" });
    }

    // Group subscriptions by business_id
    const byBusiness = new Map<string, typeof subscriptions>();
    for (const sub of subscriptions) {
      if (!byBusiness.has(sub.business_id)) byBusiness.set(sub.business_id, []);
      byBusiness.get(sub.business_id)!.push(sub);
    }

    const expiredEndpoints: string[] = [];
    let totalSent = 0;

    for (const [businessId, subs] of byBusiness) {
      const [custCount, suppCount] = await Promise.all([
        getDueCustomerCheques(businessId),
        getDueSupplierCheques(businessId),
      ]);

      const parts: string[] = [];
      if (custCount > 0) parts.push(`${custCount} customer cheque${custCount > 1 ? "s" : ""} to deposit`);
      if (suppCount > 0) parts.push(`${suppCount} supplier cheque${suppCount > 1 ? "s" : ""} to pass today`);

      if (parts.length === 0) continue;

      const payload = JSON.stringify({
        title: "Cheque Action Required",
        body: parts.join(" · "),
        tag: `b2b-cheque-${businessId}`,
        data: {
          route: "/dashboard/office",
          businessId,
        },
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          totalSent++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired — clean it up
            expiredEndpoints.push(sub.endpoint);
          } else {
            console.error("Push send error:", err.message);
          }
        }
      }
    }

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    return NextResponse.json({ sent: totalSent, expired: expiredEndpoints.length });
  } catch (err) {
    console.error("Trigger error:", err);
    return NextResponse.json({ error: "Failed to send notifications" }, { status: 500 });
  }
}

// Allow GET for manual testing in browser
export async function GET(request: NextRequest) {
  return POST(request);
}
