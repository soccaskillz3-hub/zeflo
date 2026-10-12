import "server-only";

import webpush, {WebPushError, type PushSubscription} from "web-push";
import {COMPONENTS} from "./classSchedule";
import {SUPPORT_EMAIL} from "./site";
import {formatTime} from "./time";

// Sending notifications through the browser's push service (Apple's, Google's, Mozilla's). The
// VAPID keys prove the messages come from Zeflo; the public half is also in the browser, which
// hands it to the push service when someone turns reminders on.

export type Notice = {title: string; body: string; url: string; tag: string};

// What a reminder from the database (claim_reminders) says. The database only knows what's due;
// the wording lives here.
export type DueReminder = {kind: string; tag: string; data: Record<string, unknown>};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1);

export function noticeFor({kind, tag, data}: DueReminder): Notice | null {
  if (kind === "session") {
    const minutes = count(data.minutes);
    return {
      title: text(data.subject) || "Study session",
      body: `Starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, at ${formatTime(text(data.start))}.`,
      url: "/",
      tag,
    };
  }
  if (kind === "test") {
    const component = text(data.component);
    const location = text(data.location);
    return {
      title: `${text(data.code)} ${(COMPONENTS[component] ?? component) || "Test"} tomorrow`.trim(),
      body: `At ${formatTime(text(data.start))}${location && location !== "TBA" ? `, ${location}` : ""}. A good night for one last review.`,
      url: "/",
      tag,
    };
  }
  if (kind === "streak") {
    const days = count(data.days);
    return {
      title: `Keep your ${days}-day streak`,
      body: "Nothing's checked off today yet. One session keeps it going.",
      url: "/",
      tag,
    };
  }
  return null;
}

// How long the push service should keep trying a phone that's off: a session reminder is no use
// once the session has started.
export function lifetimeFor({kind, data}: DueReminder) {
  if (kind === "session") return count(data.minutes) * 60;
  return 2 * 60 * 60;
}

let configured = false;
function configure() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new Error("Reminders aren't set up: the VAPID keys are missing.");
  if (!configured) {
    webpush.setVapidDetails(`mailto:${SUPPORT_EMAIL ?? "zeflo.help@gmail.com"}`, publicKey, privateKey);
    configured = true;
  }
}

// Sends one notification. "gone" means the device no longer accepts them (the app was removed,
// or notifications were turned off), so its address should be forgotten.
export async function sendNotice(subscription: PushSubscription, notice: Notice, ttlSeconds: number): Promise<"sent" | "gone" | "failed"> {
  configure();
  try {
    await webpush.sendNotification(subscription, JSON.stringify(notice), {TTL: ttlSeconds, urgency: "high"});
    return "sent";
  } catch (error) {
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) return "gone";
    console.error("Push failed", error instanceof WebPushError ? error.statusCode : error);
    return "failed";
  }
}
