"use client";

import clsx from "clsx";
import type { QuizResult } from "@vesna/shared";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";

interface QuizResultCardProps {
  result: QuizResult;
}

const bmiCategoryLabels: Record<string, string> = {
  underweight: "Недостаточный вес",
  normal: "Нормальный вес",
  overweight: "Избыточный вес",
  obese: "Ожирение",
};

const bmiCategoryColors: Record<string, string> = {
  underweight: "bg-tg-link/15 text-tg-link",
  normal: "bg-vesna-green/15 text-vesna-green-dark",
  overweight: "bg-vesna-orange/15 text-vesna-orange",
  obese: "bg-vesna-red/15 text-vesna-red",
};

const tierLabels: Record<string, string> = {
  free: "Бесплатный",
  premium: "Премиум",
  clinical: "Клинический",
};

const tierColors: Record<string, string> = {
  free: "bg-tg-hint/20 text-tg-text",
  premium: "bg-vesna-green/15 text-vesna-green-dark",
  clinical: "bg-vesna-orange/15 text-vesna-orange",
};

function severityColor(severity: number): string {
  if (severity >= 3) return "bg-vesna-red";
  if (severity >= 2) return "bg-vesna-orange";
  return "bg-vesna-green";
}

function severityTextColor(severity: number): string {
  if (severity >= 3) return "text-vesna-red";
  if (severity >= 2) return "text-vesna-orange";
  return "text-vesna-green";
}

export function QuizResultCard({ result }: QuizResultCardProps): JSX.Element {
  const ageDiff = result.metabolicAge - result.passportAge;
  const isOlder = ageDiff > 0;
  const isSame = ageDiff === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Metabolic Age vs Passport Age */}
      <Card className="text-center">
        <p className="mb-1 text-sm font-medium text-tg-hint">
          Ваш метаболический возраст
        </p>
        <p
          className={clsx(
            "text-5xl font-bold",
            isOlder ? "text-vesna-red" : "text-vesna-green",
          )}
        >
          {result.metabolicAge}
        </p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-sm text-tg-hint">Паспортный возраст:</span>
          <span className="text-sm font-semibold text-tg-text">
            {result.passportAge}
          </span>
        </div>
        {!isSame && (
          <p
            className={clsx(
              "mt-2 text-sm font-medium",
              isOlder ? "text-vesna-red" : "text-vesna-green",
            )}
          >
            {isOlder
              ? `+${ageDiff} лет к паспортному возрасту`
              : `${ageDiff} лет — моложе паспортного!`}
          </p>
        )}
      </Card>

      {/* BMI with category badge */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-tg-hint">
              Индекс массы тела (ИМТ)
            </p>
            <p className="mt-1 text-2xl font-bold text-tg-text">
              {result.bmi.toFixed(1)}
            </p>
          </div>
          <span
            className={clsx(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
              bmiCategoryColors[result.bmiCategory] ??
                "bg-tg-hint/20 text-tg-text",
            )}
          >
            {bmiCategoryLabels[result.bmiCategory] ?? result.bmiCategory}
          </span>
        </div>
      </Card>

      {/* Health Risks with severity indicators */}
      {result.risks.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Выявленные риски
          </h3>
          <div className="flex flex-col gap-3">
            {result.risks.map((risk) => (
              <div key={risk.type} className="flex items-start gap-3">
                <div
                  className={clsx(
                    "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                    severityColor(risk.severity),
                  )}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-tg-text">
                      {risk.title}
                    </p>
                    <span
                      className={clsx(
                        "text-xs font-semibold",
                        severityTextColor(risk.severity),
                      )}
                    >
                      {risk.severity >= 3
                        ? "Высокий"
                        : risk.severity >= 2
                          ? "Средний"
                          : "Низкий"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-tg-hint">
                    {risk.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recommended Tier */}
      <Card className="text-center">
        <p className="mb-2 text-sm font-medium text-tg-hint">
          Рекомендуемый план
        </p>
        <Badge
          className={clsx(
            "text-sm",
            tierColors[result.recommendedTier] ?? "bg-tg-hint/20 text-tg-text",
          )}
        >
          {tierLabels[result.recommendedTier] ?? result.recommendedTier}
        </Badge>
      </Card>
    </div>
  );
}
