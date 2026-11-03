import {ImageResponse} from "next/og";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

// The picture a Zeflo link shows when it's shared (iMessage, Instagram, LinkedIn, Discord...):
// the icon's night sky, with the welcome page's headline. Built once, when the site is built.

export const alt = "Zeflo: plan your study day, then actually do it.";
export const size = {width: 1200, height: 630};
export const contentType = "image/png";

// Fraunces, the forest timer's serif, as a static TTF (the image renderer can't read the woff2
// files next/font serves), and Geist, the app's sans, from the renderer's own copy.
const fraunces = await readFile(join(process.cwd(), "assets/Fraunces-SemiBold.ttf"));
const geist = await readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"));
const icon = `data:image/svg+xml;base64,${await readFile(join(process.cwd(), "app/icon.svg"), "base64")}`;

// A few stars, as fractions of the image: x, y, size.
const STARS = [
  [0.62, 0.12, 4], [0.71, 0.3, 3], [0.79, 0.09, 5], [0.86, 0.22, 3], [0.93, 0.14, 4],
  [0.67, 0.46, 3], [0.9, 0.4, 4], [0.55, 0.06, 3], [0.97, 0.55, 3], [0.76, 0.6, 2],
] as const;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(160deg, #0a1630 0%, #123a5c 62%, #1d6f86 100%)",
          color: "#eef9ff",
          fontFamily: "Geist",
          position: "relative",
        }}
      >
        {/* The glow, as a soft shadow: the renderer clips radial gradients into a hard edge. */}
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 940,
            width: 20,
            height: 20,
            borderRadius: 10,
            boxShadow: "0 0 360px 180px rgba(143,227,255,0.2)",
          }}
        />
        {STARS.map(([x, y, s], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x * size.width,
              top: y * size.height,
              width: s,
              height: s,
              borderRadius: s,
              background: "#eef9ff",
              opacity: 0.7,
            }}
          />
        ))}

        <div style={{display: "flex", alignItems: "center", gap: 24}}>
          <img src={icon} width={88} height={88} alt="" />
          <span style={{fontFamily: "Fraunces", fontSize: 48}}>Zeflo</span>
        </div>

        <div style={{display: "flex", flexDirection: "column"}}>
          <span style={{fontFamily: "Fraunces", fontSize: 80, lineHeight: 1.05}}>Plan your study day.</span>
          <span style={{fontFamily: "Fraunces", fontSize: 80, lineHeight: 1.05, color: "#8fe3ff"}}>Then actually do it.</span>
          <span style={{marginTop: 28, fontSize: 30, color: "rgba(238,249,255,0.75)"}}>
            Import your timetable, plan with your AI, and focus. Free for students.
          </span>
        </div>

        <span style={{fontSize: 26, color: "rgba(143,227,255,0.85)", letterSpacing: 2}}>zeflo.vercel.app</span>
      </div>
    ),
    {
      ...size,
      fonts: [
        {name: "Geist", data: geist, weight: 400, style: "normal"},
        {name: "Fraunces", data: fraunces, weight: 600, style: "normal"},
      ],
    },
  );
}
