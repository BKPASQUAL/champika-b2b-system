import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function useOrderLock(orderId: string) {
  const router = useRouter();
  const hasLockRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const userName = (() => {
      try {
        return JSON.parse(localStorage.getItem("currentUser") || "{}").name || "Someone";
      } catch {
        return "Someone";
      }
    })();

    fetch(`/api/orders/${orderId}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockedBy: userName }),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 409) {
          return res.json().then((data) => {
            toast.error(`This order is already being processed by ${data.lockedBy}`);
            router.back();
          });
        }
        if (res.ok) hasLockRef.current = true;
      })
      .catch(() => {
        // Don't block on lock failure — allow the page to load
        hasLockRef.current = true;
      });

    const handleBeforeUnload = () => {
      if (!hasLockRef.current) return;
      const blob = new Blob(
        [JSON.stringify({ action: "unlock" })],
        { type: "application/json" }
      );
      navigator.sendBeacon(`/api/orders/${orderId}/lock`, blob);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (hasLockRef.current) {
        hasLockRef.current = false;
        fetch(`/api/orders/${orderId}/lock`, { method: "DELETE" }).catch(() => {});
      }
    };
  }, [orderId]);
}
