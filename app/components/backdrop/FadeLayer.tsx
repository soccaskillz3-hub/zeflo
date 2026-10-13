"use client";

import {useEffect, useState, type ReactNode} from "react";

// How long a layer takes to fade (matches duration-[1800ms] below), plus a little slack.
const FADE_OUT_MS = 2000;

// A full-screen layer of the scene that fades with `opacity`, like the scene's other layers, but
// drops its contents once it has faded out completely. Hidden layers (stars by day, fireflies in
// the rain) would otherwise keep animating every frame: profiling showed a few dozen invisible
// stars and fireflies costing more CPU than everything that could be seen.
export default function FadeLayer({opacity, children}: {opacity: number; children: ReactNode}) {
  const on = opacity > 0;
  const [mounted, setMounted] = useState(on);
  // Coming back: show the contents in this same render, so they fade in with the layer.
  if (on && !mounted) setMounted(true);

  useEffect(() => {
    if (on) return;
    const id = setTimeout(() => setMounted(false), FADE_OUT_MS);
    return () => clearTimeout(id);
  }, [on]);

  return (
    <div className="absolute inset-0 transition-opacity duration-[1800ms] ease-in-out" style={{opacity}}>
      {mounted && children}
    </div>
  );
}
