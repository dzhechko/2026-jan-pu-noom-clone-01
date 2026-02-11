"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { QuizStepper } from "@/components/quiz/quiz-stepper";
import { Spinner } from "@/components/ui/spinner";
import type { QuizQuestion } from "@vesna/shared";

export default function QuizPage(): React.JSX.Element {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ questions: QuizQuestion[] }>("/api/quiz/questions")
      .then((res) => {
        if (res.data) {
          setQuestions(res.data.questions);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить вопросы");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить вопросы");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(answers: Record<string, unknown>): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post<{ quizId: string }>("/api/quiz/submit", answers);

      if (res.data) {
        // Store result for the result page
        sessionStorage.setItem("vesna_quiz_result", JSON.stringify(res.data));
        router.push(`/quiz/result?id=${res.data.quizId}`);
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
      <AppShell title="Скрининг" showNav={false}>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && questions.length === 0) {
    return (
      <AppShell title="Скрининг" showNav={false}>
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
    <AppShell title="Скрининг" showNav={false}>
      {error && (
        <div className="mx-4 mt-2 rounded-xl bg-vesna-red/10 px-4 py-3">
          <p className="text-sm font-medium text-vesna-red">{error}</p>
        </div>
      )}
      <QuizStepper
        questions={questions}
        onSubmit={handleSubmit}
        loading={submitting}
      />
    </AppShell>
  );
}
