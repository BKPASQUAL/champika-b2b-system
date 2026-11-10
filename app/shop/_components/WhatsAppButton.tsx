"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useShop } from "./ShopContext";
import { whatsappLink } from "./format";

/** WhatsApp's own logo (lucide has no brand icons). */
export function WhatsAppIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.41 9.41 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.37 9.37 0 0 1 6.67 2.77 9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.23 9.43-9.44 9.43m8.03-17.46A11.27 11.27 0 0 0 12.05.72C5.8.72.7 5.8.7 12.07c0 2 .52 3.95 1.52 5.67L.6 23.6l6-1.57a11.32 11.32 0 0 0 5.43 1.38h.01c6.26 0 11.35-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  );
}

/**
 * Green WhatsApp button that floats on every page (above the phone tab bar).
 * The message mentions the page the customer is on, so staff know what they mean.
 * Hidden until a WhatsApp number is saved in Website → Settings.
 */
export function WhatsAppButton() {
  const { store, t, base } = useShop();
  const pathname = usePathname();
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), [pathname]);

  const onProduct = pathname.slice(base.length).startsWith("/p/");
  const text = onProduct && url ? `Hi, I have a question about this item:\n${url}` : "Hi, I need help with an order.";
  const wa = whatsappLink(store.whatsapp, text);
  if (!wa) return null;

  return (
    <a
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("Chat on WhatsApp")}
      title={t("Need help? Chat with us")}
      className="group fixed right-4 bottom-20 z-40 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.65)] transition hover:bg-[#1ebe5a] md:right-6 md:bottom-6 md:px-5"
    >
      <WhatsAppIcon className="h-7 w-7 shrink-0" />
      <span className="hidden text-[15px] font-bold md:inline">{t("Chat on WhatsApp")}</span>
    </a>
  );
}
