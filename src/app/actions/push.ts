"use server";

import { createClient } from "@/lib/supabase/server";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushActionResult = { success: true } | { error: string };

// Upserts on (user_id, endpoint) — re-enabling notifications from the same
// browser (after a permission reset, a redeployed VAPID key, etc.) updates
// the existing row's keys in place rather than erroring on the unique
// constraint or accumulating a duplicate.
export async function subscribeToPush(subscription: PushSubscriptionInput): Promise<PushActionResult> {
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { error: "Incomplete push subscription." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to enable notifications." };
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function unsubscribeFromPush(endpoint: string): Promise<PushActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { error: error.message };
  return { success: true };
}
