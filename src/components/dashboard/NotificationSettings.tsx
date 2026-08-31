"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/app/actions/push";
import { urlBase64ToUint8Array } from "@/lib/push-utils";

type Status = "checking" | "unsupported" | "not-configured" | "denied" | "subscribed" | "not-subscribed";

// process.env.NEXT_PUBLIC_* is inlined at build time, safe to read directly
// in a Client Component — same as every other NEXT_PUBLIC_ var in this app.
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function NotificationSettings() {
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A genuinely async browser-API check (Notification.permission is
  // synchronous, but registration.pushManager.getSubscription() isn't) —
  // setState only ever happens inside the resulting .then()/await
  // continuation, never synchronously in the effect body itself, which is
  // exactly the pattern WeatherWidget's own geolocation check already uses.
  useEffect(() => {
    async function checkStatus() {
      if (!VAPID_PUBLIC_KEY) {
        setStatus("not-configured");
        return;
      }
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setStatus(existing ? "subscribed" : "not-subscribed");
    }
    checkStatus().catch(() => setStatus("unsupported"));
  }, []);

  function handleEnable() {
    if (!VAPID_PUBLIC_KEY) return;
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "not-subscribed");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          throw new Error("The browser returned an incomplete subscription.");
        }

        const result = await subscribeToPush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
        if ("error" in result) {
          setError(result.error);
          // The browser-side subscription still exists even though saving
          // it server-side failed — undo it rather than leaving a
          // subscription the server doesn't know about (and will never
          // send to).
          await subscription.unsubscribe();
          return;
        }
        setStatus("subscribed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't enable notifications.");
      }
    });
  }

  function handleDisable() {
    setError(null);
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const result = await unsubscribeFromPush(subscription.endpoint);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          await subscription.unsubscribe();
        }
        setStatus("not-subscribed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't disable notifications.");
      }
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {status === "checking" && (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Checking notification status…</p>
      )}

      {status === "not-configured" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Push notifications aren&apos;t configured on this deployment yet.
        </p>
      )}

      {status === "unsupported" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This browser doesn&apos;t support push notifications.
        </p>
      )}

      {status === "denied" && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Notifications are blocked for this site in your browser settings. Allow them there to enable
          daily reminders.
        </p>
      )}

      {status === "not-subscribed" && (
        <button
          type="button"
          onClick={handleEnable}
          disabled={isPending}
          className="rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPending ? "Enabling…" : "Enable Notifications"}
        </button>
      )}

      {status === "subscribed" && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Notifications enabled
          </span>
          <button
            type="button"
            onClick={handleDisable}
            disabled={isPending}
            className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {isPending ? "Disabling…" : "Disable"}
          </button>
        </div>
      )}
    </div>
  );
}
