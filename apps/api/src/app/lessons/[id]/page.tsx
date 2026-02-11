"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { LessonQuiz } from "@/components/lessons/lesson-quiz";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import type { LessonContent, LessonCompletionResult } from "@vesna/shared";

type LessonSection = "theory" | "example" | "quiz" | "result";

export default function LessonDetailPage(): React.JSX.Element {
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<LessonSection>("theory");
  const [submitting, setSubmitting] = useState(false);
  const [completionResult, setCompletionResult] = useState<LessonCompletionResult | null>(null);

  useEffect(() => {
    api
      .get<{ lesson: LessonContent }>(`/api/lessons/${lessonId}`)
      .then((res) => {
        if (res.data?.lesson) {
          setLesson(res.data.lesson);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить урок");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить урок");
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  async function handleQuizSubmit(answers: number[]): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<{ result: LessonCompletionResult }>(
        `/api/lessons/${lessonId}/complete`,
        { quizAnswers: answers },
      );

      if (res.data?.result) {
        setCompletionResult(res.data.result);
        setActiveSection("result");
      } else {
        setError(res.error?.message ?? "Ошибка при отправке ответов");
      }
    } catch {
      setError("Ошибка при отправке ответов");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Загрузка..." showBack showNav={false}>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !lesson) {
    return (
      <AppShell title="Ошибка" showBack showNav={false}>
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

  if (!lesson) {
    return (
      <AppShell title="Урок" showBack showNav={false}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-tg-hint">Урок не найден</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={lesson.title} showBack showNav={false}>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Section tabs */}
        {activeSection !== "result" && (
          <div className="flex gap-1 rounded-xl bg-tg-secondary-bg p-1">
            {(["theory", "example", "quiz"] as const).map((section) => (
              <button
                key={section}
                type="button"
                onClick={() => setActiveSection(section)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-150 ${
                  activeSection === section
                    ? "bg-tg-bg text-tg-text shadow-sm"
                    : "text-tg-hint"
                }`}
              >
                {section === "theory"
                  ? "Теория"
                  : section === "example"
                    ? "Пример"
                    : "Тест"}
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
            <p className="text-sm font-medium text-vesna-red">{error}</p>
          </div>
        )}

        {/* Theory section */}
        {activeSection === "theory" && (
          <Card>
            <div className="prose prose-sm max-w-none text-tg-text">
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: lesson.sections.theory }}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              className="mt-6 w-full"
              onClick={() => setActiveSection("example")}
            >
              Далее: Пример
            </Button>
          </Card>
        )}

        {/* Example section */}
        {activeSection === "example" && (
          <Card>
            <div className="prose prose-sm max-w-none text-tg-text">
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: lesson.sections.example }}
              />
            </div>
            <Button
              variant="primary"
              size="md"
              className="mt-6 w-full"
              onClick={() => setActiveSection("quiz")}
            >
              Перейти к тесту
            </Button>
          </Card>
        )}

        {/* Quiz section */}
        {activeSection === "quiz" && lesson.sections.quiz.questions.length > 0 && (
          <Card>
            <h2 className="mb-4 text-base font-semibold text-tg-text">
              Проверьте себя
            </h2>
            <LessonQuiz
              questions={lesson.sections.quiz.questions}
              onSubmit={handleQuizSubmit}
              loading={submitting}
            />
          </Card>
        )}

        {/* Result section */}
        {activeSection === "result" && completionResult && (
          <div className="flex flex-col gap-4">
            <Card className="text-center">
              <div className="mb-2">
                {completionResult.passed ? (
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-vesna-green/15">
                    <svg
                      className="h-8 w-8 text-vesna-green"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-vesna-orange/15">
                    <svg
                      className="h-8 w-8 text-vesna-orange"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <h2 className="text-lg font-bold text-tg-text">
                {completionResult.passed ? "Отлично!" : "Попробуйте ещё раз"}
              </h2>
              <p className="mt-1 text-sm text-tg-hint">
                Результат: {completionResult.score}%
              </p>

              <div className="mt-4 flex items-center justify-center gap-3">
                <Badge variant="xp">
                  +{completionResult.xpEarned} XP
                </Badge>
                {completionResult.streak && completionResult.streak.bonusXp > 0 && (
                  <Badge variant="streak">
                    +{completionResult.streak.bonusXp} бонус
                  </Badge>
                )}
              </div>

              {completionResult.streak && (
                <p className="mt-2 text-xs text-tg-hint">
                  Серия: {completionResult.streak.current} дней
                </p>
              )}

              <p className="mt-2 text-xs text-tg-hint">
                Попытка {completionResult.attemptsUsed} /{" "}
                {completionResult.attemptsUsed + completionResult.attemptsRemaining}
              </p>
            </Card>

            <div className="flex gap-3">
              {!completionResult.passed && completionResult.attemptsRemaining > 0 && (
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setCompletionResult(null);
                    setActiveSection("quiz");
                  }}
                >
                  Повторить
                </Button>
              )}
              {completionResult.nextLessonId ? (
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    window.location.href = `/lessons/${completionResult.nextLessonId}`;
                  }}
                >
                  Следующий урок
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    window.location.href = "/lessons";
                  }}
                >
                  К списку уроков
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
