import { cache } from "react";
import { headers } from "next/headers";
import { parseSite, SITE_HEADER, type WebSite } from "@/lib/web-site-core";

export * from "@/lib/web-site-core";

/** Which shop this request is for (BK when nothing says otherwise). Once per request. */
export const getRequestSite = cache(async (): Promise<WebSite> => {
  return parseSite((await headers()).get(SITE_HEADER)) ?? "bk";
});
