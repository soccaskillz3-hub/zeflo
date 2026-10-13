"use client";

import {useEffect} from "react";

// iOS 26 sometimes opens a Home Screen web app (e.g. from a tapped notification) with the page
// shorter than the screen by about the status bar's height: fixed things measured from the
// bottom (the scene, the tab bar) stop short, over a flat band of page background. That gap is
// kept in --ios-gap on <html> (0 everywhere else, and once iOS sorts itself out), and the
// scene and the bottom bars reach down by it (globals.css, Backdrop, Nudges, the calendar sheet).
export function useViewportGap() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & {standalone?: boolean}).standalone === true;
    if (!standalone) return;
    const root = document.documentElement;
    const measure = () => {
      // The screen's height the way the page is held (iOS reports screen sizes for portrait).
      const portrait = window.matchMedia("(orientation: portrait)").matches;
      const full = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
      const gap = Math.round(full - window.innerHeight);
      // Only a gap the size of a status bar; anything else (a keyboard, a split view) isn't this.
      root.style.setProperty("--ios-gap", gap > 0 && gap <= 100 ? `${gap}px` : "0px");
    };
    measure();
    const later = () => requestAnimationFrame(measure);
    window.addEventListener("resize", later);
    window.addEventListener("pageshow", later);
    document.addEventListener("visibilitychange", later);
    return () => {
      window.removeEventListener("resize", later);
      window.removeEventListener("pageshow", later);
      document.removeEventListener("visibilitychange", later);
    };
  }, []);
}
