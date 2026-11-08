import { z } from "zod";

/** Delivery address saved on orders and as the customer's default. */
export type ShopAddress = { line1: string; line2?: string; city: string; district: string };

export const SL_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota",
  "Jaffna", "Kalutara", "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale",
  "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya", "Polonnaruwa", "Puttalam", "Ratnapura",
  "Trincomalee", "Vavuniya",
];

/** "+94 77 123 4567" / "94771234567" / "0771234567" → "0771234567"; null when not a valid number. */
export function normalisePhone(raw: string): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("94") && d.length === 11) d = `0${d.slice(2)}`;
  if (d.length === 9 && !d.startsWith("0")) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalisePhone(v);
    if (!p) ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 077 123 4567" });
    return p || v;
  });

export const addressSchema = z.object({
  line1: z.string().trim().min(3, "Enter your house number and street").max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2, "Enter your town or city").max(100),
  district: z.string().refine((d) => SL_DISTRICTS.includes(d), "Choose your district"),
});

export function formatAddress(a: Partial<ShopAddress> | null | undefined): string {
  if (!a) return "";
  return [a.line1, a.line2, a.city, a.district ? `${a.district} District` : ""].filter(Boolean).join(", ");
}
