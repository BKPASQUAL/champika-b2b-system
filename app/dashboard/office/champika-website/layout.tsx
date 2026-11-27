// app/dashboard/office/champika-website/layout.tsx — Champika online wholesale shop portal.
// Same pages as the BK Wiring portal (app/dashboard/office/website), for the "champika" shop.
"use client";

import { WebsitePortalShell } from "../website/_shell";

export default function ChampikaWebsiteOfficeLayout({ children }: { children: React.ReactNode }) {
  return <WebsitePortalShell site="champika">{children}</WebsitePortalShell>;
}
