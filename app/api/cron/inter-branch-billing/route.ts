// Called by Vercel cron on the 1st of every month at 01:00 UTC.
// Generates inter-branch bills for the PREVIOUS month for all agencies (Orange, Wireman, Sierra)
// for both Champika Retail and Champika Distribution.
import { NextRequest, NextResponse } from "next/server";
import {
  AGENCY_CONFIGS,
  ensureCustomerInAgency,
  generateInterBranchBill,
} from "@/app/lib/inter-branch-billing";
import { BUSINESS_IDS } from "@/app/config/business-constants";

export async function GET(request: NextRequest) {
  // Compute previous month — run on the 1st so "previous month" = last month
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed current month → 1-indexed previous month
  if (month === 0) {
    // January → previous month is December of last year
    month = 12;
    year = year - 1;
  }

  const targets = [
    {
      id: BUSINESS_IDS.CHAMPIKA_RETAIL,
      label: "Champika Hardware - Retail",
      isRetail: true,
    },
    {
      id: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
      label: "Champika Hardware - Distribution",
      isRetail: false,
    },
  ];

  const results: string[] = [];

  for (const target of targets) {
    for (const agency of AGENCY_CONFIGS) {
      try {
        const prefix = target.isRetail
          ? agency.retailPrefix
          : agency.distributionPrefix;

        const customerId = await ensureCustomerInAgency(
          agency.agencyBusinessId,
          target.label,
        );
        if (!customerId) {
          results.push(`SKIP ${agency.agencyName}/${target.label}: no customer`);
          continue;
        }

        await generateInterBranchBill({
          agencyBusinessId: agency.agencyBusinessId,
          agencyName: agency.agencyName,
          invoicePrefix: prefix,
          customerId,
          customerName: target.label,
          targetBusinessId: target.id,
          billingYear: year,
          billingMonth: month,
        });

        results.push(
          `OK ${agency.agencyName}/${target.label} ${year}-${String(month).padStart(2, "0")}`,
        );
      } catch (err: any) {
        results.push(
          `ERR ${agency.agencyName}/${target.label}: ${err.message}`,
        );
      }
    }
  }

  console.log("[Cron] inter-branch-billing results:", results);
  return NextResponse.json({ month: `${year}-${String(month).padStart(2, "0")}`, results });
}
