"use client";

import {useLayoutEffect, useRef} from "react";

// For a row of links with a highlight that slides to the current one (.sf-nav-pill): measures the
// link marked aria-current="page" inside `list` and moves the pill's edges to it. Placed without
// animating the first time, so it doesn't fly in when the page loads.
export function useSlidingPill(key: string) {
  const list = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const place = () => {
      const current = list.current?.querySelector<HTMLElement>('[aria-current="page"]');
      const p = pill.current;
      if (!p) return;
      if (!current || !current.offsetWidth) {
        p.style.opacity = "0";
        return;
      }
      if (!placed.current) p.dataset.instant = "";
      p.style.opacity = "1";
      const left = current.offsetLeft;
      const right = left + current.offsetWidth;
      // Which way it's going decides which edge leads (see .sf-nav-pill). Only when it moves:
      // re-measuring in place (fonts loading, resizing) keeps the direction it had.
      const was = parseFloat(p.style.getPropertyValue("--pl"));
      if (left !== was) p.dataset.dir = left < was ? "left" : "right";
      p.style.setProperty("--pl", `${left}px`);
      p.style.setProperty("--pr", `${right}px`);
      if (!placed.current) {
        void p.offsetWidth; // apply the position before turning transitions back on
        delete p.dataset.instant;
        placed.current = true;
      }
    };
    place();
    document.fonts?.ready.then(place);
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [key]);

  return {list, pill};
}
