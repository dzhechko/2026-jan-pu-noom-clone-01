"use client";

import clsx from "clsx";

interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className }: ProgressBarProps): JSX.Element {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx(
        "h-3 w-full overflow-hidden rounded-full bg-tg-secondary-bg",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-vesna-green transition-all duration-500 ease-out"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
