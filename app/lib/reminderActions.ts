"use server";

import {getUser} from "./dal";
import {sendNotice} from "./push";
import {createClient} from "./supabase/server";

// "Send a test" in Settings → Reminders: a notification to this device, so people can see that
// reminders reach them (and what one looks like) without waiting for a session.
export async function sendTestReminder(endpoint: string): Promise<{error?: string}> {
  const user = await getUser();
  if (!user) return {error: "Log in again to send a test."};
  if (typeof endpoint !== "string" || !endpoint) return {error: "This device isn't set up for reminders."};

  // Row level security only shows the logged-in person's own devices.
  const supabase = await createClient();
  const {data} = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle();
  if (!data) return {error: "This device isn't set up for reminders. Turn them off and on again."};

  const result = await sendNotice(
    {endpoint: data.endpoint, keys: {p256dh: data.p256dh, auth: data.auth}},
    {title: "Reminders are on", body: "This is what Zeflo sends before a study session.", url: "/", tag: "test"},
    60,
  );
  if (result === "gone") {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    return {error: "This device stopped accepting notifications. Turn reminders on again."};
  }
  return result === "sent" ? {} : {error: "Couldn't reach this device. Try again in a moment."};
}
