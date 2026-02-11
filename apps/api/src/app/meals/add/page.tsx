"use client";

import { useState, useRef, useCallback, type FormEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { api, getAuthToken } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MealType } from "@vesna/shared";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

interface RecognitionResult {
  dishName: string;
  calories: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  portionG: number;
  confidence: number;
  alternatives: Array<{ dishName: string; calories: number }>;
}

const mealTypes: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Завтрак" },
  { value: "lunch", label: "Обед" },
  { value: "dinner", label: "Ужин" },
  { value: "snack", label: "Перекус" },
];

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.7) return "bg-vesna-green/15 text-vesna-green-dark";
  if (confidence > 0.5) return "bg-vesna-orange/15 text-vesna-orange";
  return "bg-vesna-red/15 text-vesna-red";
}

export default function MealsAddPage(): React.JSX.Element {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual form state
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [dishName, setDishName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [portion, setPortion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recognition state
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so user can re-select same file
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Validate file type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setRecognitionError("Поддерживаются только JPEG и PNG изображения");
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setRecognitionError("Размер файла не должен превышать 5 МБ");
      return;
    }

    // Show preview
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setRecognitionError(null);
    setRecognitionResult(null);
    setRecognizing(true);

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const token = getAuthToken();

      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/meals/recognize", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          errorData?.error?.message ?? `Ошибка распознавания (${res.status})`
        );
      }

      const data = await res.json();
      setRecognitionResult(data.result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось распознать блюдо";
      setRecognitionError(message);
    } finally {
      setRecognizing(false);
    }
  }, []);

  function handleAcceptRecognition(): void {
    if (!recognitionResult) return;

    setError(null);
    setLoading(true);

    api
      .post("/api/meals", {
        mealType,
        dishName: recognitionResult.dishName,
        calories: recognitionResult.calories,
        proteinG: recognitionResult.proteinG,
        fatG: recognitionResult.fatG,
        carbsG: recognitionResult.carbsG,
        portionG: recognitionResult.portionG,
        recognitionMethod: "ai_photo",
      })
      .then((res) => {
        if (res.error) {
          setError(res.error.message);
        } else {
          router.push("/meals");
        }
      })
      .catch(() => {
        setError("Ошибка при сохранении");
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleEditRecognition(): void {
    if (!recognitionResult) return;

    // Pre-fill form fields with recognized values
    setDishName(recognitionResult.dishName);
    setCalories(String(recognitionResult.calories));
    setProtein(String(recognitionResult.proteinG));
    setFat(String(recognitionResult.fatG));
    setCarbs(String(recognitionResult.carbsG));
    setPortion(String(recognitionResult.portionG));

    // Clear recognition state so manual form is shown
    setRecognitionResult(null);
    setPhotoPreview(null);
  }

  function handleSelectAlternative(alt: { dishName: string; calories: number }): void {
    if (!recognitionResult) return;

    setRecognitionResult({
      ...recognitionResult,
      dishName: alt.dishName,
      calories: alt.calories,
    });
  }

  function handleDismissRecognition(): void {
    setRecognitionResult(null);
    setRecognitionError(null);
    setPhotoPreview(null);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/api/meals", {
        mealType,
        dishName,
        calories: Number(calories),
        proteinG: Number(protein),
        fatG: Number(fat),
        carbsG: Number(carbs),
        portionG: Number(portion),
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
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Photo recognition section */}
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handlePhotoSelect}
            className="hidden"
            aria-label="Выбрать фото блюда"
          />

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={recognizing}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Распознать по фото
          </Button>

          {/* Recognition loading state */}
          {recognizing && (
            <Card className="flex flex-col items-center gap-3 py-6">
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Загруженное фото"
                  className="h-32 w-32 rounded-xl object-cover"
                />
              )}
              <Spinner size="lg" />
              <p className="text-sm text-tg-hint">Распознаём блюдо...</p>
            </Card>
          )}

          {/* Recognition error */}
          {recognitionError && !recognizing && (
            <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
              <p className="text-sm font-medium text-vesna-red">{recognitionError}</p>
              <p className="mt-1 text-xs text-tg-hint">
                Вы можете заполнить данные вручную ниже
              </p>
            </div>
          )}

          {/* Recognition result confirmation card */}
          {recognitionResult && !recognizing && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-semibold text-tg-text">
                    {recognitionResult.dishName}
                  </h3>
                  <p className="text-sm text-tg-hint">
                    {recognitionResult.calories} ккал &middot; {recognitionResult.portionG} г
                  </p>
                </div>
                <Badge
                  className={getConfidenceColor(recognitionResult.confidence)}
                >
                  {Math.round(recognitionResult.confidence * 100)}%
                </Badge>
              </div>

              {/* Macros breakdown */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-tg-bg px-3 py-2 text-center">
                  <p className="text-xs text-tg-hint">Белки</p>
                  <p className="text-sm font-semibold text-tg-text">
                    {recognitionResult.proteinG} г
                  </p>
                </div>
                <div className="rounded-lg bg-tg-bg px-3 py-2 text-center">
                  <p className="text-xs text-tg-hint">Жиры</p>
                  <p className="text-sm font-semibold text-tg-text">
                    {recognitionResult.fatG} г
                  </p>
                </div>
                <div className="rounded-lg bg-tg-bg px-3 py-2 text-center">
                  <p className="text-xs text-tg-hint">Углеводы</p>
                  <p className="text-sm font-semibold text-tg-text">
                    {recognitionResult.carbsG} г
                  </p>
                </div>
              </div>

              {/* Alternatives */}
              {recognitionResult.alternatives.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-tg-hint">Возможные варианты:</p>
                  <div className="flex flex-wrap gap-2">
                    {recognitionResult.alternatives.slice(0, 3).map((alt) => (
                      <button
                        key={alt.dishName}
                        type="button"
                        onClick={() => handleSelectAlternative(alt)}
                        className="rounded-full border border-tg-hint/30 bg-tg-bg px-3 py-1.5 text-xs text-tg-text transition-colors hover:border-tg-button hover:bg-tg-button/10"
                      >
                        {alt.dishName} ({alt.calories} ккал)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirmation question */}
              <p className="text-center text-sm font-medium text-tg-text">
                Верно?
              </p>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  className="flex-1"
                  loading={loading}
                  onClick={handleAcceptRecognition}
                >
                  Да
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  onClick={handleEditRecognition}
                  disabled={loading}
                >
                  Изменить
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Divider between photo recognition and manual form */}
        {!recognitionResult && !recognizing && (
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-tg-hint/20" />
            <span className="text-xs text-tg-hint">или введите вручную</span>
            <div className="h-px flex-1 bg-tg-hint/20" />
          </div>
        )}

        {/* Manual form — hidden when recognition result is showing */}
        {!recognitionResult && !recognizing && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
        )}

        {/* Error when in recognition mode */}
        {recognitionResult && error && (
          <div className="rounded-xl bg-vesna-red/10 px-4 py-3">
            <p className="text-sm font-medium text-vesna-red">{error}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
