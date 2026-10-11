"use client";

import {useScene} from "../lib/scene";
import type {TimeOfDay, Weather} from "../lib/weather";

// A line on the welcome page pointing out that the scene behind it is the visitor's own sky:
// their time of day, and their weather once we know it. Says nothing until it can be true.

const TIME: Record<TimeOfDay, string> = {sunrise: "Sunrise", day: "Daytime", dusk: "Dusk", night: "Night"};
const WEATHER: Record<Weather, string> = {
  clear: "clear skies",
  cloudy: "cloudy",
  rain: "raining",
  storm: "stormy",
  snow: "snowing",
  fog: "foggy",
};

export default function LiveSky() {
  const {ready, time, weather, status, timeOverride, weatherOverride} = useScene();
  if (!ready || timeOverride || weatherOverride) return null;
  const now = status === "live" ? `${TIME[time]}, ${WEATHER[weather]}` : TIME[time];

  return (
    <p className="sf-rise flex items-center gap-3 text-[11px] uppercase tracking-[0.3em] text-white/80">
      <span className="wl-live-dot" aria-hidden />
      <span>
        <span className="text-scene-ink">{now}</span> where you are. That&apos;s your sky behind this page.
      </span>
    </p>
  );
}
