import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700",
  secondary: "border border-brand-700 text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-700",
  ghost: "text-muted hover:bg-gray-100 focus-visible:outline-gray-700",
  danger: "border border-red-700 text-red-700 hover:bg-red-50 focus-visible:outline-red-700",
  /** For dark surfaces (landing hero). */
  inverse: "bg-white text-brand-950 shadow-lg shadow-black/20 hover:bg-brand-50 focus-visible:outline-white",
};

export function buttonClasses(variant: ButtonVariant = "primary", extra?: string): string {
  return [base, variants[variant], extra].filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
