"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import type { DuelScoreboard } from "@vesna/shared";

interface DuelScoreboardCardProps {
  scoreboard: DuelScoreboard;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Завершено";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}мин`;
  return `${minutes}мин`;
}

export function DuelScoreboardCard({ scoreboard }: DuelScoreboardCardProps): React.JSX.Element {
  const [remaining, setRemaining] = useState(scoreboard.remainingMs);

  useEffect(() => {
    if (scoreboard.status !== "active" || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 60000));
    }, 60000);
    return () => clearInterval(interval);
  }, [scoreboard.status, remaining]);

  const { challenger, opponent } = scoreboard;
  const maxScore = Math.max(challenger.score, opponent.score, 1);

  return (
    <Card className="w-full">
      {/* Timer */}
      {scoreboard.status === "active" && (
        <div className="mb-4 text-center">
          <span className="text-xs text-tg-hint">Осталось</span>
          <p className="text-lg font-bold text-tg-text">
            {formatTimeRemaining(remaining)}
          </p>
        </div>
      )}

      {/* Score comparison */}
      <div className="flex items-center gap-4">
        {/* Challenger */}
        <div className="flex-1 text-center">
          <p className="mb-1 truncate text-sm font-medium text-tg-text">
            {challenger.name}
          </p>
          <p className="text-3xl font-bold text-tg-button">{challenger.score}</p>
          <div className="mt-2 h-2 rounded-full bg-tg-hint/10">
            <div
              className="h-2 rounded-full bg-tg-button transition-all duration-500"
              style={{ width: `${(challenger.score / maxScore) * 100}%` }}
            />
          </div>
        </div>

        {/* VS separator */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tg-secondary-bg">
          <span className="text-sm font-bold text-tg-hint">VS</span>
        </div>

        {/* Opponent */}
        <div className="flex-1 text-center">
          <p className="mb-1 truncate text-sm font-medium text-tg-text">
            {opponent.name}
          </p>
          <p className="text-3xl font-bold text-vesna-orange">{opponent.score}</p>
          <div className="mt-2 h-2 rounded-full bg-tg-hint/10">
            <div
              className="h-2 rounded-full bg-vesna-orange transition-all duration-500"
              style={{ width: `${(opponent.score / maxScore) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Scoring legend */}
      <div className="mt-4 rounded-xl bg-tg-bg p-3">
        <p className="mb-2 text-xs font-semibold text-tg-hint">Как зарабатывать очки:</p>
        <div className="flex flex-col gap-1 text-xs text-tg-hint">
          <div className="flex justify-between">
            <span>Пройти урок</span>
            <span className="font-medium text-tg-text">+10</span>
          </div>
          <div className="flex justify-between">
            <span>Записать приём пищи</span>
            <span className="font-medium text-tg-text">+5</span>
          </div>
          <div className="flex justify-between">
            <span>Серия (1 раз/день)</span>
            <span className="font-medium text-tg-text">+5</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
