// hooks/usePushNotifications.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type PushStatus = "unsupported" | "denied" | "default" | "subscribed" | "loading" | "no-sw";

// Gets an active SW registration — tries existing registrations first,
// then falls back to registering /sw.js explicitly (needed on iOS PWA first open).
async function getActiveSW(): Promise<ServiceWorkerRegistration | null> {
  try {
    // 1. Check if a registration already exists and is active
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active) return reg;
    }

    // 2. Try registering /sw.js explicitly (iOS PWA sometimes needs this)
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch {
      // /sw.js may not exist (dev mode) — fall through
      return null;
    }

    // 3. If already active, return immediately
    if (reg.active) return reg;

    // 4. Wait up to 12 seconds for the SW to finish installing and activate
    return await new Promise<ServiceWorkerRegistration | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 12_000);

      const sw = reg.installing ?? reg.waiting;
      if (!sw) { clearTimeout(timeout); resolve(null); return; }

      sw.addEventListener("statechange", () => {
        if (sw.state === "activated") {
          clearTimeout(timeout);
          resolve(reg);
        }
      });
    });
  } catch {
    return null;
  }
}

export function usePushNotifications(businessId: string) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const checkStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const reg = await getActiveSW();
      if (!reg) {
        setStatus("no-sw");
        return;
      }
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSubscription(existing);
        setStatus("subscribed");
      } else {
        setStatus("default");
      }
    } catch {
      setStatus("default");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!vapidKey) {
      toast.error("Push not configured — VAPID keys not set on this server.");
      return false;
    }

    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        toast.error("Notifications blocked. Allow them in Settings → Safari → this site → Notifications.");
        return false;
      }
      if (permission !== "granted") {
        setStatus("default");
        return false;
      }

      const reg = await getActiveSW();
      if (!reg) {
        setStatus("no-sw");
        toast.error("Service worker not ready. Close and re-open the app from your Home Screen, then try again.");
        return false;
      }

      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: pushSub.toJSON(), businessId }),
      });

      if (!res.ok) throw new Error("Server failed to save subscription");

      setSubscription(pushSub);
      setStatus("subscribed");
      toast.success("Push notifications enabled!");
      return true;
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast.error(err?.message ?? "Could not enable push notifications. Try again.");
      setStatus("default");
      return false;
    }
  }, [vapidKey, businessId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription) return false;
    try {
      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
      setSubscription(null);
      setStatus("default");
      toast.success("Push notifications disabled.");
      return true;
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      toast.error("Could not disable. Try again.");
      return false;
    }
  }, [subscription]);

  return { status, subscribe, unsubscribe };
}
