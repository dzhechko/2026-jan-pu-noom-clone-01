"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import clsx from "clsx";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback((): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = 120; // ~5 lines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  function handleChange(text: string): void {
    setValue(text);
    // Defer height adjustment to after state update
    requestAnimationFrame(adjustHeight);
  }

  function handleSend(): void {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-tg-hint/10 bg-tg-bg px-4 pb-[env(safe-area-inset-bottom,8px)] pt-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Напишите сообщение..."
          disabled={disabled}
          rows={1}
          className={clsx(
            "flex-1 resize-none rounded-2xl border border-tg-hint/30 bg-tg-secondary-bg px-4 py-2.5 text-sm text-tg-text",
            "placeholder:text-tg-hint",
            "transition-colors duration-150",
            "focus:border-tg-button focus:outline-none focus:ring-1 focus:ring-tg-button/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={clsx(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-150",
            canSend
              ? "bg-tg-button text-tg-button-text active:scale-95"
              : "bg-tg-hint/20 text-tg-hint cursor-not-allowed",
          )}
          aria-label="Отправить"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 12h14M12 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
