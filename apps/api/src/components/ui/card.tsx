"use client";

import { type ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps): JSX.Element {
  return (
    <div
      className={clsx(
        "rounded-2xl bg-tg-secondary-bg p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
