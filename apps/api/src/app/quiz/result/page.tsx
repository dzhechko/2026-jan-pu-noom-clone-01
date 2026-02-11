"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { QuizResultCard } from "@/components/quiz/quiz-result-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { QuizResult } from "@vesna/shared";

function QuizResultContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const quizId = searchParams.get("id");

  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Try to restore result from sessionStorage (set by quiz submit)
    const stored = sessionStorage.getItem("vesna_quiz_result");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as QuizResult;
        if (!quizId || parsed.quizId === quizId) {
          setResult(parsed);
          setLoading(false);
          return;
        }
      } catch {
        // Ignore parse errors, proceed to fetch
      }
    }

    if (!quizId) {
      setError("Результат не найден");
      setLoading(false);
      return;
    }

    // Fallback: try to get from save endpoint (result stored in Redis)
    api
      .get<{ result: QuizResult }>(`/api/quiz/save?quizId=${quizId}`)
      .then((res) => {
        if (res.data?.result) {
          setResult(res.data.result);
        } else {
          setError("Результат не найден или истёк");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить результат");
      })
      .finally(() => setLoading(false));
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
        <p className="text-sm text-vesna-red">
          {error ?? "Результат не найден"}
        </p>
        <Link href="/quiz">
          <Button variant="secondary" size="md">
            Пройти заново
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-6">
      <QuizResultCard result={result} />

      <Link href="/lessons" className="w-full">
        <Button variant="primary" size="lg" className="w-full">
          Начать обучение
        </Button>
      </Link>
    </div>
  );
}

export default function QuizResultPage(): React.JSX.Element {
  return (
    <AppShell title="Ваш результат" showNav={false}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        }
      >
        <QuizResultContent />
      </Suspense>
    </AppShell>
  );
}
