import type { ReactNode } from "react";

/** Class names shared by text inputs, selects and textareas. */
export const inputClass =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-fg placeholder:text-muted aria-[invalid=true]:border-fail";

type FieldProps = { label: string; hint?: string; error?: string | undefined; children: ReactNode };

/** A labelled form control with an optional hint and an inline error in plain language. */
export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">{label}</span>
        {children}
      </label>
      {hint && !error && <span className="text-[11px] text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-[11px] text-fail">
          {error}
        </span>
      )}
    </div>
  );
}
