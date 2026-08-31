// The standard conversion needed to hand a VAPID public key (stored as a
// URL-safe base64 string, the format web-push's generateVAPIDKeys() and the
// NEXT_PUBLIC_VAPID_PUBLIC_KEY env var both use) to
// PushManager.subscribe()'s applicationServerKey, which requires a raw
// Uint8Array instead.
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
