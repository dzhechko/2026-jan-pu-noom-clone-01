"use client";

import { type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({
  label,
  error,
  id,
  className,
  ...props
}: InputProps): JSX.Element {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-tg-text"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          "w-full rounded-xl border bg-tg-bg px-4 py-2.5 text-tg-text",
          "placeholder:text-tg-hint",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-tg-button/50",
          error
            ? "border-vesna-red focus:ring-vesna-red/50"
            : "border-tg-hint/30 focus:border-tg-button",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {error && (
        <p className="text-sm text-vesna-red">{error}</p>
      )}
    </div>
  );
}
