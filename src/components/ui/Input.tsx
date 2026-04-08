import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={id}
          className="text-xs text-[var(--text-secondary)] font-medium"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`w-full px-3 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] ${className}`}
        {...props}
      />
    </div>
  );
}
