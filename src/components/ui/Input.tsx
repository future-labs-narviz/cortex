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
        className={`h-10 w-full px-4 text-sm rounded-[var(--radius-xl)] bg-[var(--muted)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-active)] focus:ring-1 focus:ring-[var(--accent-soft)] focus:bg-[var(--muted-hover)] outline-none transition-all duration-200 ${className}`}
        {...props}
      />
    </div>
  );
}
