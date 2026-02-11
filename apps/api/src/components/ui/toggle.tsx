"use client";

import clsx from "clsx";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps): JSX.Element {
  return (
    <label
      className={clsx(
        "flex items-center justify-between gap-3 py-3",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-tg-text">{label}</p>
        {description && (
          <p className="text-xs text-tg-hint mt-0.5">{description}</p>
        )}
      </div>
      <div className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        <div
          className={clsx(
            "h-7 w-12 rounded-full transition-colors duration-200",
            checked ? "bg-tg-button" : "bg-tg-hint/20",
          )}
        />
        <div
          className={clsx(
            "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked && "translate-x-5",
          )}
        />
      </div>
    </label>
  );
}
