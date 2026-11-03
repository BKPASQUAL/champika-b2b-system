// app/dashboard/office/distribution/orders/_components/useOrderPortal.ts
// The order workflow pages are shared by Distribution, Orange and Sierra.
// This works out which portal we are in from the URL, so each portal only
// sees its own orders and its links stay inside that portal.
"use client";

import { usePathname } from "next/navigation";
import { BUSINESS_IDS, getBusinessName } from "@/app/config/business-constants";

export interface OrderPortal {
  businessId: string;
  businessName: string;
  basePath: string;
  /** Base path for a single return note page, e.g. `${returnsPath}/${id}` */
  returnsPath: string;
}

const AGENCY_PORTALS: { prefix: string; businessId: string }[] = [
  { prefix: "/dashboard/office/orange", businessId: BUSINESS_IDS.ORANGE_AGENCY },
  { prefix: "/dashboard/office/sierra", businessId: BUSINESS_IDS.SIERRA_AGENCY },
];

export function getOrderPortal(pathname: string | null | undefined): OrderPortal {
  const path = pathname || "";
  const agency = AGENCY_PORTALS.find((p) => path.startsWith(p.prefix));
  if (agency) {
    return {
      businessId: agency.businessId,
      businessName: getBusinessName(agency.businessId),
      basePath: agency.prefix,
      returnsPath: `${agency.prefix}/orders/returns`,
    };
  }
  const basePath = "/dashboard/office/distribution";
  return {
    businessId: BUSINESS_IDS.CHAMPIKA_DISTRIBUTION,
    businessName: getBusinessName(BUSINESS_IDS.CHAMPIKA_DISTRIBUTION),
    basePath,
    returnsPath: `${basePath}/inventory/returns`,
  };
}

export function useOrderPortal(): OrderPortal {
  return getOrderPortal(usePathname());
}
