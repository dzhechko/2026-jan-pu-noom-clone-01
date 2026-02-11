"use client";

import clsx from "clsx";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-3",
};

export function Spinner({ size = "md", className }: SpinnerProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label="Загрузка"
      className={clsx(
        "animate-spin rounded-full border-tg-button border-t-transparent",
        sizeClasses[size],
        className,
      )}
    />
  );
}
