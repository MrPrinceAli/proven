import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800 focus-visible:outline-emerald-700",
  secondary:
    "border border-emerald-700 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-emerald-700",
  ghost: "text-gray-700 hover:bg-gray-100 focus-visible:outline-gray-700",
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
