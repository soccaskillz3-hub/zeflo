"use client";

import {useEffect} from "react";

// On desktop, a soft light follows the pointer across whichever glass card it's over (.sf-card's
// ::after reads --gx, --gy and --glow). It eases after the pointer rather than sticking to it,
// so it feels like light moving over glass. Decorative, so nothing on touch screens.
export default function GlassLight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let card: HTMLElement | null = null;
    const at = {x: 0, y: 0, tx: 0, ty: 0};
    let raf = 0;

    const frame = () => {
      raf = 0;
      if (!card) return;
      at.x += (at.tx - at.x) * 0.18;
      at.y += (at.ty - at.y) * 0.18;
      card.style.setProperty("--gx", `${at.x.toFixed(1)}px`);
      card.style.setProperty("--gy", `${at.y.toFixed(1)}px`);
      if (Math.abs(at.tx - at.x) + Math.abs(at.ty - at.y) > 0.5) raf = requestAnimationFrame(frame);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const over = (e.target as Element | null)?.closest<HTMLElement>(".sf-card") ?? null;
      if (over !== card) {
        card?.style.setProperty("--glow", "0");
        card = over;
        if (!card) return;
        // A new card: start the light where the pointer came in.
        const r = card.getBoundingClientRect();
        at.x = at.tx = e.clientX - r.left;
        at.y = at.ty = e.clientY - r.top;
        card.style.setProperty("--glow", "1");
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      at.tx = e.clientX - r.left;
      at.ty = e.clientY - r.top;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const leave = () => {
      card?.style.setProperty("--glow", "0");
      card = null;
    };

    window.addEventListener("pointermove", move, {passive: true});
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
