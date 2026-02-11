"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";

interface MealEntry {
  id: string;
  mealType: string;
  dishName: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  portionG: number;
  loggedAt: string;
}

interface MealsResponse {
  meals: MealEntry[];
}

const mealTypeLabels: Record<string, string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

const mealTypeIcons: Record<string, string> = {
  breakfast: "&#x2615;",
  lunch: "&#x1F372;",
  dinner: "&#x1F37D;",
  snack: "&#x1F34E;",
};

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Сегодня";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    }
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

function groupByDate(meals: MealEntry[]): Record<string, MealEntry[]> {
  const groups: Record<string, MealEntry[]> = {};

  for (const meal of meals) {
    const dateKey = new Date(meal.loggedAt).toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(meal);
  }

  return groups;
}

export default function MealsPage(): React.JSX.Element {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<MealsResponse>("/api/meals")
      .then((res) => {
        if (res.data) {
          setMeals(res.data.meals);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить питание");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить питание");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell title="Питание" showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Питание" showNav>
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

  const grouped = groupByDate(meals);
  const dateKeys = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  return (
    <AppShell title="Питание" showNav>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Add button */}
        <Link href="/meals/add">
          <Button variant="primary" size="md" className="w-full">
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Добавить приём пищи
          </Button>
        </Link>

        {/* Empty state */}
        {meals.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tg-secondary-bg">
              <svg
                className="h-8 w-8 text-tg-hint"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-tg-text">
              Нет записей о питании
            </p>
            <p className="mt-1 max-w-xs text-xs text-tg-hint">
              Начните отслеживать приёмы пищи для лучшего понимания ваших привычек
            </p>
          </div>
        )}

        {/* Grouped meal cards */}
        {dateKeys.map((dateKey) => {
          const dateMeals = grouped[dateKey];
          const totalCalories = dateMeals.reduce((sum, m) => sum + m.calories, 0);

          return (
            <div key={dateKey}>
              {/* Date header */}
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-tg-text">
                  {formatDate(dateMeals[0].loggedAt)}
                </h3>
                <span className="text-xs font-medium text-tg-hint">
                  {totalCalories} ккал
                </span>
              </div>

              {/* Meals for this date */}
              <div className="flex flex-col gap-2">
                {dateMeals.map((meal) => (
                  <Card key={meal.id}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-secondary-bg">
                        <span
                          className="text-lg"
                          dangerouslySetInnerHTML={{
                            __html: mealTypeIcons[meal.mealType] ?? "&#x1F37D;",
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-tg-text">
                            {meal.dishName}
                          </p>
                          <Badge variant="default">
                            {mealTypeLabels[meal.mealType] ?? meal.mealType}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-tg-hint">
                          <span>{meal.calories} ккал</span>
                          <span>Б: {meal.proteinG}г</span>
                          <span>Ж: {meal.fatG}г</span>
                          <span>У: {meal.carbsG}г</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
