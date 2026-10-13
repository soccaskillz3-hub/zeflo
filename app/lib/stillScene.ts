// "Still scene": the backdrop keeps its look but stops moving, for slower computers and to save
// battery (the moving scene is nearly all of Zeflo's CPU and GPU use). Kept per device, not on the
// account: a laptop on battery and a desktop want different answers. Applied as `data-still` on
// <html>, which globals.css uses to pause the scene; the first-frame script (sceneScript.ts) sets
// it before the page appears.

export const STILL_KEY = "studyflow:still-scene";

export function readStill() {
  try {
    return localStorage.getItem(STILL_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStill(on: boolean) {
  try {
    if (on) localStorage.setItem(STILL_KEY, "1");
    else localStorage.removeItem(STILL_KEY);
  } catch {
    // Not remembered; it still applies until the page reloads.
  }
  document.documentElement.toggleAttribute("data-still", on);
}
