import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import type { ButtonVariant, ButtonSize } from "@/lib/types";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "btn-primary text-white shadow-[var(--shadow-md)] border border-[rgba(255,255,255,0.15)] hover:shadow-[var(--shadow-glow)] hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "bg-[var(--muted)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--muted-hover)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--text-primary)]",
  glass:
    "bg-[var(--muted)] [-webkit-backdrop-filter:blur(24px)] backdrop-blur-xl border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--muted-hover)]",
  destructive:
    "btn-destructive text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-xs gap-1.5 rounded-[var(--radius-md)]",
  md: "text-sm gap-2 rounded-[var(--radius-lg)]",
  lg: "text-base gap-2 rounded-[var(--radius-xl)]",
  icon: "rounded-[var(--radius-lg)]",
};

// Use inline styles for sizing to guarantee Safari 15 renders padding correctly
const sizeInline: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, paddingLeft: 14, paddingRight: 14 },
  md: { height: 40, paddingLeft: 20, paddingRight: 20 },
  lg: { height: 48, paddingLeft: 32, paddingRight: 32 },
  icon: { width: 40, height: 40 },
};

export function Button({
  variant = "secondary",
  size = "md",
  children,
  className = "",
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeClasses[size]} ${className}`}
      style={{ ...sizeInline[size], ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
