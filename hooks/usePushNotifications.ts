// hooks/usePushNotifications.ts
"use client";

import { useState, useEffect, useCallback } from "react";

export type PushStatus = "unsupported" | "denied" | "default" | "subscribed" | "loading";

export function usePushNotifications(businessId: string) {
  const [status, setStatus] = useState<PushStatus>("loading");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  const checkStatus = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
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
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
      return false;
    }

    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      // Modern browsers accept the base64url string directly — no Uint8Array conversion needed
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: pushSub.toJSON(), businessId }),
      });

      setSubscription(pushSub);
      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
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
      return true;
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      return false;
    }
  }, [subscription]);

  return { status, subscribe, unsubscribe };
}
