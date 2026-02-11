"use client";

import { type ReactNode } from "react";
import clsx from "clsx";

type BadgeVariant = "default" | "xp" | "streak" | "tier";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-tg-hint/20 text-tg-text",
  xp: "bg-vesna-green/15 text-vesna-green-dark",
  streak: "bg-vesna-orange/15 text-vesna-orange",
  tier: "bg-tg-button/15 text-tg-button",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
