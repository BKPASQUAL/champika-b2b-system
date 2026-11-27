// app/dashboard/office/website/layout.tsx — BK Wiring online shop portal
"use client";

import { WebsitePortalShell } from "./_shell";

export default function WebsiteOfficeLayout({ children }: { children: React.ReactNode }) {
  return <WebsitePortalShell site="bk">{children}</WebsitePortalShell>;
}
