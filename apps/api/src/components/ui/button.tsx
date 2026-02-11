"use client";

import { type ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import { Spinner } from "./spinner";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-tg-button text-tg-button-text hover:opacity-90 active:opacity-80",
  secondary:
    "bg-tg-secondary-bg text-tg-text border border-tg-hint/20 hover:bg-tg-hint/10 active:bg-tg-hint/20",
  ghost:
    "bg-transparent text-tg-text hover:bg-tg-secondary-bg active:bg-tg-hint/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-base rounded-xl",
  lg: "px-6 py-3.5 text-lg rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps): JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-tg-button/50",
        variantClasses[variant],
        sizeClasses[size],
        isDisabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...props}
    >
      {loading && <Spinner size={size === "lg" ? "md" : "sm"} />}
      {children}
    </button>
  );
}
