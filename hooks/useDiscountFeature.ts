"use client";

import { useState, useEffect } from "react";

type Portal = "wireman" | "sierra" | "orange" | "distribution";

export function useDiscountFeature(portal: Portal): { enabled: boolean; loading: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/discount-feature")
      .then((r) => r.json())
      .then((data) => setEnabled(data[portal] ?? false))
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false));
  }, [portal]);

  return { enabled, loading };
}
