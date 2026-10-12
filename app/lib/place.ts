import "server-only";

import {headers} from "next/headers";

// Roughly where the visitor is (their city), for the scene's weather and sunrise and sunset.
// Vercel works it out from the connection and adds it to every request, so nobody is asked for
// their location. Null where there's no Vercel in front (local development) or it can't tell.
export type Place = {latitude: number; longitude: number; city: string | null};

export async function visitorPlace(): Promise<Place | null> {
  const h = await headers();
  const latitude = Number(h.get("x-vercel-ip-latitude"));
  const longitude = Number(h.get("x-vercel-ip-longitude"));
  if (!h.get("x-vercel-ip-latitude") || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  let city: string | null = null;
  try {
    city = decodeURIComponent(h.get("x-vercel-ip-city") ?? "") || null; // sent URL-encoded
  } catch {
    city = null;
  }
  // Two decimals (about a kilometre) is all the weather needs.
  return {latitude: Math.round(latitude * 100) / 100, longitude: Math.round(longitude * 100) / 100, city};
}
