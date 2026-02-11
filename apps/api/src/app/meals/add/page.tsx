"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MealType } from "@vesna/shared";

const mealTypes: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Завтрак" },
  { value: "lunch", label: "Обед" },
  { value: "dinner", label: "Ужин" },
  { value: "snack", label: "Перекус" },
];

export default function MealsAddPage(): React.JSX.Element {
  const router = useRouter();
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [dishName, setDishName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [portion, setPortion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/api/meals", {
        mealType,
        dishName,
        calories: Number(calories),
        protein: Number(protein),
        fat: Number(fat),
        carbs: Number(carbs),
        portionGrams: Number(portion),
      });

      if (res.error) {
        setError(res.error.message);
      } else {
        router.push("/meals");
      }
    } catch {
      setError("Ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Добавить приём пищи" showBack showNav={false}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 py-6">
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

        {/* Dish name */}
        <Input
          label="Название блюда"
          type="text"
          value={dishName}
          onChange={(e) => setDishName(e.target.value)}
          placeholder="Например: Овсяная каша"
          required
        />

        {/* Calories */}
        <Input
          label="Калории (ккал)"
          type="number"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="0"
          min={0}
          max={5000}
          required
        />

        {/* Macros row */}
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Белки (г)"
            type="number"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
            min={0}
            max={500}
          />
          <Input
            label="Жиры (г)"
            type="number"
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            placeholder="0"
            min={0}
            max={500}
          />
          <Input
            label="Углеводы (г)"
            type="number"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="0"
            min={0}
            max={500}
          />
        </div>

        {/* Portion */}
        <Input
          label="Порция (г)"
          type="number"
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          placeholder="100"
          min={1}
          max={5000}
        />

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
            <p className="text-sm font-medium text-vesna-red">{error}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="mt-2 w-full"
        >
          Сохранить
        </Button>
      </form>
    </AppShell>
  );
}
