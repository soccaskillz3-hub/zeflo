"use client";

import {useState} from "react";

// For content that can arrive after its page has opened (data read from the account): a class
// that keeps its space while it's missing, then fades it in when it arrives (.sf-reveal). Content
// that was ready when the page opened isn't animated: it came in with the page's crossfade.
export function useReveal(ready: boolean) {
  const [readyAtFirst] = useState(ready);
  if (readyAtFirst) return "";
  return ready ? "sf-reveal" : "invisible";
}
