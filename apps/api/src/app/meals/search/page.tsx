"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { MealType } from "@vesna/shared";

interface SearchResult {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

interface SearchResponse {
  results: SearchResult[];
}

const mealTypes: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Завтрак" },
  { value: "lunch", label: "Обед" },
  { value: "dinner", label: "Ужин" },
  { value: "snack", label: "Перекус" },
];

function scaleNutrient(per100g: number, portionG: number): number {
  return Math.round((per100g * portionG) / 100);
}

export default function MealsSearchPage(): React.JSX.Element {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFood, setSelectedFood] = useState<SearchResult | null>(null);
  const [portionG, setPortionG] = useState("100");
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (q: string): Promise<void> => {
    if (q.trim().length === 0) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await api.get<SearchResponse>(
        `/api/meals/search?q=${encodeURIComponent(q.trim())}&limit=10`,
      );

      if (res.data) {
        setResults(res.data.results);
      } else {
        setError(res.error?.message ?? "Не удалось выполнить поиск");
        setResults([]);
      }
    } catch {
      setError("Не удалось выполнить поиск");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void performSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  function handleSelectFood(food: SearchResult): void {
    setSelectedFood(food);
    setPortionG("100");
    setSubmitError(null);
  }

  function handleDeselectFood(): void {
    setSelectedFood(null);
    setPortionG("100");
    setSubmitError(null);
  }

  async function handleAddMeal(): Promise<void> {
    if (!selectedFood) return;

    const portion = Number(portionG);
    if (!portion || portion <= 0) {
      setSubmitError("Укажите корректную порцию");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await api.post("/api/meals", {
        mealType,
        dishName: selectedFood.name,
        calories: scaleNutrient(selectedFood.caloriesPer100g, portion),
        proteinG: scaleNutrient(selectedFood.proteinPer100g, portion),
        fatG: scaleNutrient(selectedFood.fatPer100g, portion),
        carbsG: scaleNutrient(selectedFood.carbsPer100g, portion),
        portionG: portion,
      });

      if (res.error) {
        setSubmitError(res.error.message);
      } else {
        router.push("/meals");
      }
    } catch {
      setSubmitError("Ошибка при сохранении");
    } finally {
      setSubmitting(false);
    }
  }

  const portion = Number(portionG) || 0;

  return (
    <AppShell title="Поиск продуктов" showBack showNav={false}>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Search input */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg
              className="h-5 w-5 text-tg-hint"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
          </div>
          <Input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedFood(null);
            }}
            placeholder="Например: борщ"
            className="pl-10"
          />
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Initial state — no query entered */}
        {!loading && !searched && (
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
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <p className="text-sm text-tg-hint">
              Введите название продукта
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
            <p className="text-sm font-medium text-vesna-red">{error}</p>
          </div>
        )}

        {/* Empty results */}
        {!loading && searched && !error && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-tg-hint">
              Ничего не найдено
            </p>
          </div>
        )}

        {/* Selected food — expanded card */}
        {selectedFood && (
          <Card className="border border-tg-button/30">
            <div className="flex flex-col gap-4">
              {/* Header with close button */}
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-tg-text">
                  {selectedFood.name}
                </p>
                <button
                  type="button"
                  onClick={handleDeselectFood}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-tg-hint hover:bg-tg-hint/10"
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
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Per 100g info */}
              <div className="flex items-center gap-3 text-xs text-tg-hint">
                <span>На 100 г:</span>
                <span>{selectedFood.caloriesPer100g} ккал</span>
                <span>Б: {selectedFood.proteinPer100g}г</span>
                <span>Ж: {selectedFood.fatPer100g}г</span>
                <span>У: {selectedFood.carbsPer100g}г</span>
              </div>

              {/* Portion input */}
              <Input
                label="Порция (г)"
                type="number"
                value={portionG}
                onChange={(e) => setPortionG(e.target.value)}
                placeholder="100"
                min={1}
                max={5000}
              />

              {/* Scaled nutrition */}
              {portion > 0 && (
                <div className="rounded-xl bg-tg-bg px-4 py-3">
                  <p className="mb-1 text-xs font-medium text-tg-hint">
                    Итого на {portion} г:
                  </p>
                  <div className="flex items-center gap-4 text-sm font-semibold text-tg-text">
                    <span>{scaleNutrient(selectedFood.caloriesPer100g, portion)} ккал</span>
                    <span className="text-xs font-normal text-tg-hint">
                      Б: {scaleNutrient(selectedFood.proteinPer100g, portion)}г
                    </span>
                    <span className="text-xs font-normal text-tg-hint">
                      Ж: {scaleNutrient(selectedFood.fatPer100g, portion)}г
                    </span>
                    <span className="text-xs font-normal text-tg-hint">
                      У: {scaleNutrient(selectedFood.carbsPer100g, portion)}г
                    </span>
                  </div>
                </div>
              )}

              {/* Meal type selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-tg-text">
                  Тип приёма пищи
                </label>
                <div className="flex gap-2">
                  {mealTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setMealType(type.value)}
                      className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                        mealType === type.value
                          ? "border-tg-button bg-tg-button/10 text-tg-button"
                          : "border-tg-hint/30 bg-tg-bg text-tg-hint"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
                  <p className="text-sm font-medium text-vesna-red">{submitError}</p>
                </div>
              )}

              {/* Add button */}
              <Button
                type="button"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full"
                onClick={() => void handleAddMeal()}
              >
                Добавить
              </Button>
            </div>
          </Card>
        )}

        {/* Search results list */}
        {!loading && !selectedFood && results.length > 0 && (
          <div className="flex flex-col gap-2">
            {results.map((item, idx) => (
              <button
                key={`${item.name}-${idx}`}
                type="button"
                onClick={() => handleSelectFood(item)}
                className="w-full text-left"
              >
                <Card>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tg-secondary-bg">
                      <svg
                        className="h-5 w-5 text-tg-hint"
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
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-tg-text">
                        {item.name}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-tg-hint">
                        <span>{item.caloriesPer100g} ккал/100г</span>
                        <span>Б: {item.proteinPer100g}г</span>
                        <span>Ж: {item.fatPer100g}г</span>
                        <span>У: {item.carbsPer100g}г</span>
                      </div>
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
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
