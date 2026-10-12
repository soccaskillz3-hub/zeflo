"use client";

import {useSyncExternalStore} from "react";
import {createClient} from "./supabase/client";

// Whether this device gets reminders, and turning them on and off. Each device is set up on its
// own (it's the device that shows the notification); what to be reminded about is a preference
// on the account (see prefs.tsx). The sending happens on the server: app/api/reminders.
//
//   checking     finding out
//   unsupported  this browser can't show notifications from a website
//   install      an iPhone or iPad in Safari: only works once Zeflo is on the Home Screen
//   blocked      notifications were turned down for Zeflo; only the device's settings can undo it
//   off / on     for this device
export type ReminderStatus = "checking" | "unsupported" | "install" | "blocked" | "off" | "on";

type State = {status: ReminderStatus; endpoint: string | null};

let state: State = {status: "checking", endpoint: null};
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  listeners.forEach((l) => l());
};

const isAppleMobile = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Opened from the Home Screen (or as an installed app on a computer), not in a browser tab.
export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// Push addresses are tied to the person logged in here, so they're saved (or refreshed: the
// keys and time zone can change) on the account each time Zeflo opens.
async function save(subscription: PushSubscription) {
  const {keys} = subscription.toJSON();
  const {error} = await createClient().rpc("save_push_subscription", {
    sub_endpoint: subscription.endpoint,
    sub_p256dh: keys?.p256dh ?? "",
    sub_auth: keys?.auth ?? "",
    sub_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return !error;
}

async function check() {
  if (isAppleMobile() && !isInstalled()) return set({status: "install", endpoint: null});
  if (!supported()) return set({status: "unsupported", endpoint: null});
  if (Notification.permission === "denied") return set({status: "blocked", endpoint: null});
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {scope: "/", updateViaCache: "none"});
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && Notification.permission === "granted") {
      set({status: "on", endpoint: subscription.endpoint});
      void save(subscription);
    } else {
      set({status: "off", endpoint: null});
    }
  } catch {
    set({status: "unsupported", endpoint: null});
  }
}

let started = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    void check();
    // Coming back from the device's settings (say, after allowing notifications) shows the change.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void check();
    });
  }
  return () => listeners.delete(listener);
}

const SERVER_STATE: State = {status: "checking", endpoint: null};

export function useReminders() {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Call straight from a tap: browsers only ask for permission in response to one.
export async function turnOnReminders(): Promise<string | null> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return "Reminders aren't available yet.";
  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    set({status: "blocked", endpoint: null});
    return null;
  }
  if (permission !== "granted") return "Zeflo needs permission to send notifications. Try again and choose Allow.";
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(key)}));
    if (!(await save(subscription))) {
      await subscription.unsubscribe();
      return "Couldn't save this device. Check your connection and try again.";
    }
    set({status: "on", endpoint: subscription.endpoint});
    return null;
  } catch {
    return "This device couldn't sign up for notifications. Try again in a moment.";
  }
}

export async function turnOffReminders() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
  set({status: "off", endpoint: null});
}

// Logging out: this device stops getting the account's reminders. (The push service then
// reports the address as gone, and the server forgets it.)
export function forgetRemindersHere() {
  if (!("serviceWorker" in navigator)) return;
  set({status: isAppleMobile() && !isInstalled() ? "install" : "off", endpoint: null});
  navigator.serviceWorker
    .getRegistration()
    .then((r) => r?.pushManager.getSubscription())
    .then((s) => s?.unsubscribe())
    .catch(() => {});
}

// Checks this device once Zeflo opens, which also keeps its push address and time zone fresh on
// the account. Renders nothing.
export function RemindersSync() {
  useReminders();
  return null;
}
