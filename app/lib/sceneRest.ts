"use client";

import {useEffect} from "react";

// The scene rests when nobody is looking at it closely: after a minute without touching the app,
// a few seconds after switching to another window, or straight away when the tab is hidden. The
// moving scene is nearly all of Zeflo's CPU and GPU use, and a laptop left showing the app (the
// timer running beside a textbook, Zeflo on a second screen) would otherwise spin its fans up
// drawing waves no one is watching. Any input wakes it at once.
//
// Resting is `data-resting` on <html>, in two steps (globals.css): "fade" lets falling rain and
// snow, dust and animals fade out while still moving, then "still" pauses everything, so nothing
// hangs frozen in mid-air. Waking removes it and they fade back in.

const IDLE_MS = 60_000;
const AWAY_MS = 10_000;
const FADE_MS = 1600; // matches .sf-falling's transition

export function useSceneRest() {
  useEffect(() => {
    const root = document.documentElement;
    let last = performance.now();
    let idle = 0;
    let fade = 0;

    const rest = () => {
      if (root.hasAttribute("data-resting")) return;
      root.setAttribute("data-resting", "fade");
      fade = window.setTimeout(() => root.setAttribute("data-resting", "still"), FADE_MS);
    };
    const wake = () => {
      clearTimeout(fade);
      root.removeAttribute("data-resting");
    };

    // One timer for idleness, re-armed for whatever time is left rather than on every input.
    const arm = (ms: number) => {
      clearTimeout(idle);
      idle = window.setTimeout(check, ms);
    };
    const check = () => {
      if (document.hidden || !document.hasFocus()) return rest();
      const left = IDLE_MS - (performance.now() - last);
      if (left <= 0) rest();
      else arm(left);
    };

    const active = () => {
      last = performance.now();
      if (root.hasAttribute("data-resting")) {
        wake();
        arm(IDLE_MS);
      }
    };
    const blur = () => arm(AWAY_MS);
    const focus = () => {
      active();
      arm(IDLE_MS);
    };
    const visibility = () => (document.hidden ? rest() : focus());

    const opts = {passive: true, capture: true};
    const inputs = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;
    inputs.forEach((type) => document.addEventListener(type, active, opts));
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    arm(document.hasFocus() ? IDLE_MS : AWAY_MS);

    return () => {
      inputs.forEach((type) => document.removeEventListener(type, active, opts));
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(idle);
      wake();
    };
  }, []);
}
