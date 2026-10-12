"use client";

import {useSyncExternalStore} from "react";

// Putting Zeflo on a Home Screen, in the Dock or among a computer's apps (see app/manifest.ts).
// Every browser does it differently, so the steps depend on where Zeflo is open.
//
//   iphone          iPhone or iPad (any browser: they all use Safari's Add to Home Screen)
//   android         an Android phone or tablet
//   mac-safari      Safari on a Mac (File → Add to Dock)
//   desktop         Chrome, Edge, Brave, Arc… on a computer (an install button)
//   firefox         Firefox on a computer, which can't install websites
//   other           anything else
export type Platform = "iphone" | "android" | "mac-safari" | "desktop" | "firefox" | "other";

export const isAppleMobile = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Opened from the Home Screen (or as an installed app on a computer), not in a browser tab.
export const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;

function detect(): Platform {
  const ua = navigator.userAgent;
  if (isAppleMobile()) return "iphone";
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\//.test(ua)) return "mac-safari";
  if (/Chrome\/|Edg\//.test(ua)) return "desktop";
  return "other";
}

export const isPhone = (p: Platform) => p === "iphone" || p === "android";

// Chrome and Edge offer their own one-tap install, through an event that can arrive before React
// starts; the head script in layout.tsx (INSTALL_SCRIPT) holds on to it until it's needed.
type InstallEvent = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: "accepted" | "dismissed"}>};
declare global {
  interface Window {
    __zefloInstall?: InstallEvent | null;
  }
}

export const INSTALL_SCRIPT = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__zefloInstall=e});addEventListener("appinstalled",function(){window.__zefloInstall=null})`;

type State = {platform: Platform; installed: boolean; canPrompt: boolean} | null;

let state: State = null;
const listeners = new Set<() => void>();
const refresh = () => {
  state = {platform: detect(), installed: isInstalled(), canPrompt: Boolean(window.__zefloInstall)};
  listeners.forEach((l) => l());
};

let started = false;
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!started) {
    started = true;
    refresh();
    window.addEventListener("beforeinstallprompt", () => setTimeout(refresh));
    window.addEventListener("appinstalled", () => setTimeout(refresh));
    window.matchMedia("(display-mode: standalone)").addEventListener("change", refresh);
  }
  return () => listeners.delete(listener);
}

// Null until known (on the server, and for the first moment in the browser).
export function useInstall() {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

// The browser's own install window. True if they went ahead.
export async function promptInstall() {
  const event = window.__zefloInstall;
  window.__zefloInstall = null; // each offer can only be used once
  try {
    if (!event) return false;
    await event.prompt();
    return (await event.userChoice).outcome === "accepted";
  } catch {
    return false; // the browser withdrew the offer; the guide's steps still work
  } finally {
    refresh();
  }
}

// "Not now" to the install offer is remembered on this device: it's this device that would get
// the app, so the offer can still show on the others.
const DISMISSED_KEY = "studyflow:install-dismissed";

export function installOfferDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissInstallOffer() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Storage unavailable: the offer comes back next time, which is harmless.
  }
}
