import { ensureWebCustomer } from "@/lib/web-auth";
import { ProfileForm } from "./ProfileForm";
import { TradeCard } from "./TradeCard";

export default async function AccountPage() {
  const c = await ensureWebCustomer();
  if (!c) return null; // the layout already sends guests to log in
  const a = (c.default_address || {}) as Record<string, string>;
  return (
    <div className="space-y-5">
    <TradeCard status={(c.trade_status as any) || "none"} />
    <ProfileForm
      initial={{
        fullName: c.full_name || "",
        phone: c.phone || "",
        line1: a.line1 || "",
        line2: a.line2 || "",
        city: a.city || "",
        district: a.district || "",
      }}
      email={c.email}
    />
    </div>
  );
}
