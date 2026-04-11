import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { BUSINESS_IDS } from "@/app/config/business-constants";

/**
 * POST /api/setup/inter-branch-customers
 *
 * Pre-creates "Champika Hardware - Retail" and "Champika Hardware - Distribution"
 * as customers inside Orange, Wireman, and Sierra agency portals.
 * Safe to call multiple times — skips any that already exist.
 */

const INTERNAL_CUSTOMERS = [
  { name: "Champika Hardware - Retail" },
  { name: "Champika Hardware - Distribution" },
];

const AGENCIES = [
  { name: "Orange Agency",  businessId: BUSINESS_IDS.ORANGE_AGENCY },
  { name: "Wireman Agency", businessId: BUSINESS_IDS.WIREMAN_AGENCY },
  { name: "Sierra Agency",  businessId: BUSINESS_IDS.SIERRA_AGENCY },
];

export async function POST() {
  const results: { agency: string; customer: string; status: string }[] = [];

  for (const agency of AGENCIES) {
    for (const customer of INTERNAL_CUSTOMERS) {
      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("business_id", agency.businessId)
        .ilike("shop_name", customer.name)
        .maybeSingle();

      if (existing) {
        results.push({ agency: agency.name, customer: customer.name, status: "already_exists" });
        continue;
      }

      // Create it
      const { error } = await supabaseAdmin.from("customers").insert({
        shop_name: customer.name,
        owner_name: "Champika Hardware",
        phone: "",
        address: "Internal - Champika Hardware",
        route: "Internal",
        status: "Active",
        credit_limit: 99999999,
        outstanding_balance: 0,
        business_id: agency.businessId,
      });

      if (error) {
        results.push({ agency: agency.name, customer: customer.name, status: `error: ${error.message}` });
      } else {
        results.push({ agency: agency.name, customer: customer.name, status: "created" });
      }
    }
  }

  return NextResponse.json({ results });
}
