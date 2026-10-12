import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono, Jost } from "next/font/google";
import "./globals.css";
import GlassLight from "./components/GlassLight";
import { AccountProvider } from "./lib/account";
import { ClassesProvider } from "./lib/classes";
import { INSTALL_SCRIPT } from "./lib/install";
import { PrefsProvider } from "./lib/prefs";
import { RemindersSync } from "./lib/reminders";
import { getUser } from "./lib/dal";
import { SceneProvider } from "./lib/scene";
import { SCENE_SCRIPT } from "./lib/sceneScript";
import { ScheduleProvider } from "./lib/schedule";
import { SettingsSync } from "./lib/settingsSync";
import { SoundProvider } from "./lib/sound";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display faces for the focus timer, one per theme for a different feel in each: a thin,
// airy geometric sans by the ocean, and a chunky, soft, storybook serif in the forest
// (see --font-timer in globals.css).
const jost = Jost({
  variable: "--font-jost",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
  subsets: ["latin"],
});

// Every current iPhone screen: CSS width and height, and pixel ratio.
const SPLASH_SIZES = [
  [440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2], [320, 568, 2],
] as const;

export const metadata: Metadata = {
  title: "Zeflo",
  description: "Plan your study day and track your progress.",
  // Added to an iPhone's Home Screen, Zeflo opens as an app (see manifest.ts), with the scene
  // running up under the status bar as it does in Safari.
  appleWebApp: {
    capable: true,
    title: "Zeflo",
    statusBarStyle: "black-translucent",
    // Shown while the app opens (an iPhone shows white otherwise): Zeflo's icon on its night
    // sky, one image per iPhone screen size (public/splash).
    startupImage: SPLASH_SIZES.map(([w, h, r]) => ({
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    })),
  },
};

// Draw edge to edge, under the iPhone's status bar and Safari's toolbar, so the scene fills the
// whole screen. The body's padding (globals.css) keeps the app itself clear of them.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jost.variable} ${fraunces.variable} h-full antialiased`}
      // The head script sets the scene's data attributes before React loads.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCENE_SCRIPT }} />
        {/* Holds on to Chrome's install offer, which can come before React starts (lib/install.ts). */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AccountProvider account={user}>
          <SceneProvider>
            <GlassLight />
            <SoundProvider>
              {user && <SettingsSync key={`settings-${user.id}`} userId={user.id} />}
              {user && <RemindersSync />}
              {/* Keyed by account, so nothing from one login carries over to the next. */}
              <PrefsProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
                <ScheduleProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
                  <ClassesProvider key={user?.id ?? "guest"} userId={user?.id ?? null}>
                    {children}
                  </ClassesProvider>
                </ScheduleProvider>
              </PrefsProvider>
            </SoundProvider>
          </SceneProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
