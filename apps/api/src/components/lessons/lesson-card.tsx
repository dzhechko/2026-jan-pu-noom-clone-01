"use client";

import clsx from "clsx";
import type { LessonListItem } from "@vesna/shared";

interface LessonCardProps {
  lesson: LessonListItem;
  onClick: () => void;
}

const statusLabels: Record<LessonListItem["status"], string> = {
  completed: "Пройден",
  available: "Доступен",
  locked: "Заблокирован",
  review_needed: "Повторить",
  paywall: "Премиум",
};

const statusColors: Record<LessonListItem["status"], string> = {
  completed: "bg-vesna-green/15 text-vesna-green-dark",
  available: "bg-tg-link/15 text-tg-link",
  locked: "bg-tg-hint/20 text-tg-hint",
  review_needed: "bg-vesna-orange/15 text-vesna-orange",
  paywall: "bg-yellow-400/15 text-yellow-600",
};

const statusIcons: Record<LessonListItem["status"], string> = {
  completed: "✓",
  available: "▶",
  locked: "🔒",
  review_needed: "↻",
  paywall: "★",
};

export function LessonCard({ lesson, onClick }: LessonCardProps): JSX.Element {
  const isInteractive = lesson.status !== "locked";

  return (
    <button
      type="button"
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl bg-tg-secondary-bg p-4 text-left transition-all duration-150",
        isInteractive
          ? "active:scale-[0.98] active:bg-tg-hint/10"
          : "cursor-not-allowed opacity-60",
      )}
    >
      {/* Lesson number */}
      <div
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          lesson.status === "completed"
            ? "bg-vesna-green text-white"
            : lesson.status === "available"
              ? "bg-tg-button text-tg-button-text"
              : "bg-tg-hint/20 text-tg-hint",
        )}
      >
        {lesson.status === "completed" ? statusIcons.completed : lesson.id}
      </div>

      {/* Title and details */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            "truncate text-sm font-semibold",
            isInteractive ? "text-tg-text" : "text-tg-hint",
          )}
        >
          {lesson.title}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {/* Status badge */}
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              statusColors[lesson.status],
            )}
          >
            {statusLabels[lesson.status]}
          </span>

          {/* Score if completed */}
          {lesson.quizScore !== null && (
            <span className="text-xs text-tg-hint">
              {lesson.quizScore}%
            </span>
          )}

          {/* XP earned */}
          {lesson.xpEarned > 0 && (
            <span className="text-xs font-medium text-vesna-green-dark">
              +{lesson.xpEarned} XP
            </span>
          )}
        </div>
      </div>

      {/* Arrow for interactive items */}
      {isInteractive && (
        <svg
          className="h-5 w-5 shrink-0 text-tg-hint"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
      )}
    </button>
  );
}
