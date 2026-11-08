/** Small shared form pieces for the shop (login, checkout, account). */

export const inputCls =
  "h-11 w-full rounded-xl border border-(--s-line) bg-(--s-surface) px-3.5 text-sm text-(--s-ink) outline-none transition placeholder:text-(--s-muted) focus:border-(--s-accent) focus:ring-4 focus:ring-(--s-accent-soft) disabled:opacity-60";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-(--s-accent) px-6 text-sm font-semibold text-(--s-accent-ink) transition hover:bg-(--s-accent-hover) disabled:cursor-not-allowed disabled:opacity-60";

export const btnDark =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-(--s-btn) px-6 text-sm font-semibold text-(--s-btn-ink) transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export const btnOutline =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-(--s-line) bg-(--s-surface) px-6 text-sm font-semibold text-(--s-ink) transition hover:border-(--s-ink) disabled:cursor-not-allowed disabled:opacity-60";

export const cardCls = "rounded-3xl border border-(--s-line) bg-(--s-surface)";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-[13px] font-medium text-(--s-ink-2)">{label}</span>
      {children}
      {error ? <span className="block text-xs text-(--s-bad)">{error}</span> : hint ? <span className="block text-xs text-(--s-muted)">{hint}</span> : null}
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  const cls =
    tone === "error"
      ? "border-(--s-bad) text-(--s-bad)"
      : tone === "success"
        ? "border-(--s-good) text-(--s-good)"
        : "border-(--s-line) bg-(--s-soft) text-(--s-ink-2)";
  return <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

/** Google "G" logo for the sign-in button. */
export function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
