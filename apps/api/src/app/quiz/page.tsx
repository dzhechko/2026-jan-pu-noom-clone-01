"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { QuizStepper } from "@/components/quiz/quiz-stepper";
import { Spinner } from "@/components/ui/spinner";
import type { QuizQuestion, QuizAnswers, QuizResult } from "@vesna/shared";

const GENDER_MAP: Record<string, string> = {
  "Мужской": "male",
  "Женский": "female",
};

const ACTIVITY_MAP: Record<string, string> = {
  "Сидячий образ жизни": "sedentary",
  "Лёгкая активность": "light",
  "Умеренная активность": "moderate",
  "Активный образ жизни": "active",
};

const STRESS_MAP: Record<string, string> = {
  "Низкий": "low",
  "Умеренный": "moderate",
  "Высокий": "high",
  "Очень высокий": "very_high",
};

const MEALS_MAP: Record<string, number> = {
  "1-2 раза": 2,
  "3 раза": 3,
  "4 и более": 5,
};

const SNACKING_MAP: Record<string, string> = {
  "Никогда": "never",
  "Редко": "rarely",
  "Часто": "often",
};

const MEDICAL_CONDITIONS_MAP: Record<string, string> = {
  "Диабет": "diabetes",
  "Гипертония": "hypertension",
  "Щитовидная железа": "thyroid",
};

function transformQuizAnswers(raw: Record<string, unknown>): QuizAnswers {
  const medicalRaw = (raw["11"] as string[] | undefined) ?? [];
  const medicationsRaw = (raw["12"] as string[] | undefined) ?? [];

  return {
    gender: GENDER_MAP[raw["1"] as string] as QuizAnswers["gender"],
    age: raw["2"] as number,
    heightCm: raw["3"] as number,
    weightKg: raw["4"] as number,
    activityLevel: ACTIVITY_MAP[raw["5"] as string] as QuizAnswers["activityLevel"],
    sleepHours: raw["6"] as number,
    stressLevel: STRESS_MAP[raw["7"] as string] as QuizAnswers["stressLevel"],
    mealsPerDay: MEALS_MAP[raw["8"] as string] ?? 3,
    snackingFrequency: SNACKING_MAP[raw["9"] as string] as QuizAnswers["snackingFrequency"],
    waterGlasses: raw["10"] as number,
    medicalConditions: medicalRaw
      .filter((v) => v !== "Нет" && MEDICAL_CONDITIONS_MAP[v] !== undefined)
      .map((v) => MEDICAL_CONDITIONS_MAP[v]) as QuizAnswers["medicalConditions"],
    medications: medicationsRaw.filter((v) => v !== "Нет"),
  };
}

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
      const transformed = transformQuizAnswers(answers);
      const res = await api.post<QuizResult>("/api/quiz/submit", transformed);

      if (res.data) {
        // Store result for the result page
        sessionStorage.setItem("vesna_quiz_result", JSON.stringify(res.data));
        router.push(`/quiz/result?id=${res.data.quizId}`);
      } else {
        setError(res.error?.message ?? "Ошибка при отправке ответов");
      }
    } catch (err) {
      console.error("[quiz/submit]", err);
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
