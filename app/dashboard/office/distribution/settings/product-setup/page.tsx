"use client";

// Distribution copy of Admin > Settings > Categories, so distribution staff can
// manage categories, sub categories, product families, specs, brands and pack sizes.
import { CategorySettings } from "@/app/dashboard/admin/settings/_components/CategorySettings";

export default function DistributionProductSetupPage() {
  return (
    <div className="p-4 md:p-6">
      <CategorySettings />
    </div>
  );
}
