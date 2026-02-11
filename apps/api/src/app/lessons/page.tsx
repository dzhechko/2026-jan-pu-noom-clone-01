"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { LessonCard } from "@/components/lessons/lesson-card";
import { Spinner } from "@/components/ui/spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { LessonListItem } from "@vesna/shared";
import { TOTAL_LESSONS } from "@vesna/shared";

export default function LessonsPage(): React.JSX.Element {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ lessons: LessonListItem[] }>("/api/lessons")
      .then((res) => {
        if (res.data) {
          setLessons(res.data.lessons);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить уроки");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить уроки");
      })
      .finally(() => setLoading(false));
  }, []);

  const completedCount = lessons.filter((l) => l.status === "completed").length;
  const progress = TOTAL_LESSONS > 0 ? (completedCount / TOTAL_LESSONS) * 100 : 0;

  if (loading) {
    return (
      <AppShell title="Уроки" showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Уроки" showNav>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
          <p className="text-sm text-vesna-red">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-sm font-medium text-tg-link"
          >
            Попробовать снова
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Уроки" showNav>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Progress summary */}
        <div className="rounded-2xl bg-tg-secondary-bg p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-tg-text">
              Прогресс
            </span>
            <span className="text-xs font-medium text-tg-hint">
              {completedCount} / {TOTAL_LESSONS}
            </span>
          </div>
          <ProgressBar value={progress} />
        </div>

        {/* Lesson list */}
        <div className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              onClick={() => router.push(`/lessons/${lesson.id}`)}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
