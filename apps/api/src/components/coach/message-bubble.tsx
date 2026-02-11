"use client";

import clsx from "clsx";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MessageBubble({
  role,
  content,
  createdAt,
}: MessageBubbleProps): JSX.Element {
  const isUser = role === "user";

  return (
    <div
      className={clsx(
        "flex w-full",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-2.5",
          isUser
            ? "rounded-br-md bg-tg-button text-tg-button-text"
            : "rounded-bl-md bg-tg-secondary-bg text-tg-text",
        )}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {content}
        </p>
        <p
          className={clsx(
            "mt-1 text-[10px]",
            isUser ? "text-tg-button-text/60" : "text-tg-hint",
          )}
        >
          {formatTime(createdAt)}
        </p>
      </div>
    </div>
  );
}
