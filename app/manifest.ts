import type {MetadataRoute} from "next";

// What a phone needs to put Zeflo on its Home Screen as an app: opening full screen, without the
// browser around it, and in its own place in the app switcher. Being installed is also what lets
// an iPhone show Zeflo's reminders.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Zeflo",
    short_name: "Zeflo",
    description: "Plan your study day and track your progress.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The night sky of Zeflo's icon, shown while the app opens.
    background_color: "#0a1630",
    theme_color: "#0a1630",
    icons: [
      {src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any"},
      {src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any"},
      {src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable"},
    ],
  };
}
