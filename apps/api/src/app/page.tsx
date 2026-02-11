"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

interface DashboardData {
  metabolicAge: number;
  passportAge: number;
  bmi: number;
  bmiCategory: string;
  nextLesson: { id: number; title: string } | null;
  streak: { current: number; longest: number };
  xp: number;
  level: number;
}

const bmiCategoryLabels: Record<string, string> = {
  underweight: "Недостаточный",
  normal: "Нормальный",
  overweight: "Избыточный",
  obese: "Ожирение",
};

export default function HomePage(): React.JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    setDashLoading(true);
    api
      .get<DashboardData>("/api/dashboard")
      .then((res) => {
        if (res.data) {
          setDashboard(res.data);
          setHasProfile(true);
        } else if (res.status === 404) {
          setHasProfile(false);
        } else {
          setHasProfile(false);
        }
      })
      .catch(() => {
        setHasProfile(false);
      })
      .finally(() => setDashLoading(false));
  }, [authLoading, user]);

  // Redirect to quiz if no medical profile
  useEffect(() => {
    if (hasProfile === false && user) {
      router.push("/quiz");
    }
  }, [hasProfile, user, router]);

  // Loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-tg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  // Not authenticated: welcome screen
  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-tg-bg px-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-vesna-green/15">
            <svg
              className="h-10 w-10 text-vesna-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          </div>

          <h1 className="mb-2 text-2xl font-bold text-tg-text">
            Весна
          </h1>
          <p className="mb-8 max-w-xs text-sm leading-relaxed text-tg-hint">
            Платформа управления весом на основе когнитивно-поведенческой терапии.
            Узнайте свой метаболический возраст и начните путь к здоровью.
          </p>

          <Link href="/quiz" className="w-full max-w-xs">
            <Button variant="primary" size="lg" className="w-full">
              Начать
            </Button>
          </Link>

          <Link
            href="/login"
            className="mt-4 text-sm font-medium text-tg-link transition-opacity hover:opacity-80"
          >
            Уже есть аккаунт? Войти
          </Link>
        </div>
      </div>
    );
  }

  // Authenticated but loading dashboard
  if (dashLoading || hasProfile === null) {
    return (
      <AppShell showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  // Authenticated with profile: show dashboard
  return (
    <AppShell showNav>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Greeting */}
        <div className="mb-2">
          <h1 className="text-xl font-bold text-tg-text">
            Привет, {user.name}!
          </h1>
          <p className="text-sm text-tg-hint">Ваш прогресс сегодня</p>
        </div>

        {/* Metabolic Age Card */}
        {dashboard && (
          <Card className="relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-tg-hint">
                  Метаболический возраст
                </p>
                <p className="mt-1 text-3xl font-bold text-tg-text">
                  {dashboard.metabolicAge}
                </p>
                <p className="mt-0.5 text-xs text-tg-hint">
                  Паспортный: {dashboard.passportAge}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-tg-hint">ИМТ</p>
                <p className="mt-1 text-2xl font-bold text-tg-text">
                  {dashboard.bmi.toFixed(1)}
                </p>
                <Badge variant="default" className="mt-1">
                  {bmiCategoryLabels[dashboard.bmiCategory] ?? dashboard.bmiCategory}
                </Badge>
              </div>
            </div>
          </Card>
        )}

        {/* Next Lesson Card */}
        {dashboard?.nextLesson && (
          <Link href={`/lessons/${dashboard.nextLesson.id}`}>
            <Card className="transition-all duration-150 active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-button text-tg-button-text">
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
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-tg-hint">
                    Следующий урок
                  </p>
                  <p className="truncate text-sm font-semibold text-tg-text">
                    {dashboard.nextLesson.title}
                  </p>
                </div>
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
              </div>
            </Card>
          </Link>
        )}

        {/* Streak Card */}
        {dashboard && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vesna-orange/15">
                  <span className="text-lg">&#x1F525;</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-tg-hint">Серия</p>
                  <p className="text-sm font-semibold text-tg-text">
                    {dashboard.streak.current} {dashboard.streak.current === 1 ? "день" : "дней"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="xp">
                  {dashboard.xp} XP
                </Badge>
                <p className="mt-1 text-[10px] text-tg-hint">
                  Уровень {dashboard.level}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Quick Coach Access */}
        <Link href="/coach">
          <Button variant="secondary" size="md" className="w-full">
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
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            Спросить AI коуча
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
