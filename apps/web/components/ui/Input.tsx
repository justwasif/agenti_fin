import { forwardRef } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, hint, className = "", id, ...props }, ref) {
    return (
      <label className="block" htmlFor={id}>
        {label ? (
          <span className="mb-1.5 block text-xs font-medium text-muted">
            {label}
          </span>
        ) : null}
        <input
          ref={ref}
          id={id}
          className={`h-10 w-full rounded-xl border border-ink/10 bg-surface px-3 text-sm text-ink placeholder:text-muted/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 ${className}`}
          {...props}
        />
        {hint ? (
          <span className="mt-1 block text-[11px] text-muted">{hint}</span>
        ) : null}
      </label>
    );
  },
);
