"use client";

import type {ReactNode} from "react";
import {useFormStatus} from "react-dom";

// Building blocks for the account pages (sign up, log in, password reset), styled like the
// rest of Zeflo: underlined fields and outlined buttons floating over the scene.

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.3em] text-white/80">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-3.5 py-2.5 text-white outline-none transition placeholder:text-white/40 focus:border-scene/70 [color-scheme:dark]"
      />
      {hint && <span className="mt-1.5 block text-xs text-white/55">{hint}</span>}
    </label>
  );
}

export function SubmitButton({children, pendingText}: {children: ReactNode; pendingText: string}) {
  const {pending} = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="sf-primary w-full px-5 py-3 text-[11px] uppercase tracking-[0.2em] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormError({children}: {children?: ReactNode}) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-rose-300">
      {children}
    </p>
  );
}

// Replaces a form once an email has gone out.
export function EmailSent({title, children}: {title: string; children: ReactNode}) {
  return (
    <div role="status">
      <p className="sf-serif text-balance text-3xl leading-tight">{title}</p>
      <p className="mt-4 text-sm leading-relaxed text-white/80">{children}</p>
    </div>
  );
}

export const authLink = "text-scene-soft underline decoration-scene/40 underline-offset-4 transition hover:text-scene-ink";
