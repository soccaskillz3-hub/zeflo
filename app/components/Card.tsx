import type {ComponentProps, ReactNode} from "react";

// The surface everything in the app sits on (.sf-card in globals.css): near-solid, tinted by the
// scene, so content is always readable over the sky. min-w-0 lets it shrink in a grid, so a long
// line that truncates (a session's name) can't stretch every card in the column. Cards rise in
// with a short stagger when a page opens (.sf-in).
export function Card({className = "", children, ...rest}: ComponentProps<"section">) {
  return (
    <section className={`sf-card sf-in min-w-0 p-5 sm:p-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}

// A card's top line: what it is on the left, an optional action on the right.
export function CardHead({label, children}: {label: ReactNode; children?: ReactNode}) {
  return (
    <div className="flex min-h-5 items-center justify-between gap-4">
      <h2 className="text-[11px] uppercase tracking-[0.3em] text-white/60">{label}</h2>
      {children}
    </div>
  );
}

// A small text action in a card's corner ("All progress", "Edit").
export const cardAction = "sf-press text-[11px] uppercase tracking-[0.25em] text-scene-soft transition hover:text-scene-ink";
