/** "Rs 1,020" — whole rupees, Sri Lankan style grouping. */
export function rs(n: number | null | undefined): string {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString("en-LK")}`;
}

/** wa.me link with a ready message. Accepts 07X…, 947X… or +947X… numbers. */
export function whatsappLink(number: string, text: string): string | null {
  let n = (number || "").replace(/\D/g, "");
  if (!n) return null;
  if (n.startsWith("0")) n = `94${n.slice(1)}`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Cookie that remembers light/dark mode, so the server can send the right colours. */
export const THEME_COOKIE = "bkw_theme";
