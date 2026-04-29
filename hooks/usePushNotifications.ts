// hooks/usePushNotifications.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type PushStatus =
  | "unsupported"
  | "denied"
  | "default"
  | "subscribed"
  | "loading"
  | "no-sw"
  | "localhost";

function isLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.startsWith("10.");
}

// Wait for an active SW registration up to `ms` milliseconds.
// Uses navigator.serviceWorker.ready which resolves once any SW is active.
function waitForSW(ms = 12_000): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function usePushNotifications(businessId: string) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [swError, setSwError] = useState<string>("");
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

    // Running on local dev server — SW is disabled
    if (isLocalhost()) {
      setStatus("localhost");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const reg = await waitForSW(12_000);
      if (!reg) {
        setSwError("Service worker did not become active within 12 s");
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
    } catch (e: any) {
      setSwError(e?.message ?? "Unknown SW error");
      setStatus("no-sw");
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!vapidKey) {
      toast.error("VAPID public key not set — add it to Vercel environment variables.");
      return false;
    }

    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        toast.error("Notifications blocked. Go to Settings → Safari → this site → allow Notifications.");
        return false;
      }
      if (permission !== "granted") {
        setStatus("default");
        return false;
      }

      const reg = await waitForSW(12_000);
      if (!reg) {
        setStatus("no-sw");
        toast.error("Service worker not ready. Close the app fully, reopen from Home Screen, and try again.");
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server error ${res.status}`);
      }

      setSubscription(pushSub);
      setStatus("subscribed");
      toast.success("Push notifications enabled on this device!");
      return true;
    } catch (err: any) {
      console.error("Push subscribe error:", err);
      toast.error(err?.message ?? "Could not enable push notifications.");
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
    } catch {
      toast.error("Could not disable. Try again.");
      return false;
    }
  }, [subscription]);

  return { status, swError, subscribe, unsubscribe };
}
