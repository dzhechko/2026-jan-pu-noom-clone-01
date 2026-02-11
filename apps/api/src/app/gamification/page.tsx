"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GAMIFICATION_LEVELS, STREAK_MILESTONES } from "@vesna/shared";

interface GamificationData {
  xp: number;
  level: number;
  levelName: string;
  badges: string[];
  streak: {
    current: number;
    longest: number;
  };
  lessonsCompleted: number;
  totalLessons: number;
}

export default function GamificationPage(): React.JSX.Element {
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<GamificationData>("/api/gamification")
      .then((res) => {
        if (res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить достижения");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить достижения");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell title="Достижения" showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="Достижения" showNav>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
          <p className="text-sm text-vesna-red">
            {error ?? "Данные не найдены"}
          </p>
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

  // Calculate XP progress
  const currentLevelData = GAMIFICATION_LEVELS.find(
    (l) => l.level === data.level,
  );
  const nextLevelData = GAMIFICATION_LEVELS.find(
    (l) => l.level === data.level + 1,
  );
  const xpForCurrent = currentLevelData?.xpRequired ?? 0;
  const xpForNext = nextLevelData?.xpRequired ?? data.xp;
  const xpRange = xpForNext - xpForCurrent;
  const xpProgress = xpRange > 0 ? ((data.xp - xpForCurrent) / xpRange) * 100 : 100;

  return (
    <AppShell title="Достижения" showNav>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* XP and Level card */}
        <Card className="text-center">
          <p className="text-xs font-medium text-tg-hint">Уровень</p>
          <p className="mt-1 text-4xl font-bold text-tg-text">{data.level}</p>
          <p className="text-sm font-medium text-tg-button">
            {data.levelName}
          </p>

          <div className="mt-4 flex items-center justify-between text-xs text-tg-hint">
            <span>{data.xp} XP</span>
            {nextLevelData && <span>{xpForNext} XP</span>}
          </div>
          <ProgressBar value={xpProgress} className="mt-1" />

          {nextLevelData && (
            <p className="mt-2 text-xs text-tg-hint">
              До уровня {nextLevelData.name}: {xpForNext - data.xp} XP
            </p>
          )}
        </Card>

        {/* Streak visual */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Серия дней
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vesna-orange/15">
                <span className="text-2xl">&#x1F525;</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-tg-text">
                  {data.streak.current}
                </p>
                <p className="text-xs text-tg-hint">текущая серия</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-tg-text">
                {data.streak.longest}
              </p>
              <p className="text-xs text-tg-hint">рекорд</p>
            </div>
          </div>

          {/* Streak milestones */}
          <div className="mt-4 flex gap-2">
            {STREAK_MILESTONES.map((milestone) => {
              const achieved = data.streak.longest >= milestone.days;
              return (
                <div
                  key={milestone.days}
                  className={`flex flex-1 flex-col items-center rounded-xl p-2 ${
                    achieved
                      ? "bg-vesna-green/10"
                      : "bg-tg-hint/10"
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      achieved ? "text-vesna-green-dark" : "text-tg-hint"
                    }`}
                  >
                    {milestone.days}д
                  </span>
                  <span
                    className={`text-[10px] ${
                      achieved ? "text-vesna-green" : "text-tg-hint"
                    }`}
                  >
                    +{milestone.bonusXp}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Lessons progress */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Уроки
          </h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-tg-hint">Пройдено</span>
            <span className="text-xs font-medium text-tg-text">
              {data.lessonsCompleted} / {data.totalLessons}
            </span>
          </div>
          <ProgressBar
            value={
              data.totalLessons > 0
                ? (data.lessonsCompleted / data.totalLessons) * 100
                : 0
            }
          />
        </Card>

        {/* Badges */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Значки
          </h3>
          {data.badges.length === 0 ? (
            <p className="text-sm text-tg-hint">
              Пока нет значков. Продолжайте заниматься!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.badges.map((badge) => (
                <Badge key={badge} variant="xp">
                  {badge}
                </Badge>
              ))}
            </div>
          )}
        </Card>

        {/* All levels */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Уровни
          </h3>
          <div className="flex flex-col gap-2">
            {GAMIFICATION_LEVELS.map((level) => {
              const isCurrentLevel = level.level === data.level;
              const isAchieved = data.xp >= level.xpRequired;

              return (
                <div
                  key={level.level}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                    isCurrentLevel
                      ? "bg-tg-button/10 border border-tg-button/30"
                      : isAchieved
                        ? "bg-vesna-green/5"
                        : "bg-tg-hint/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold ${
                        isCurrentLevel
                          ? "text-tg-button"
                          : isAchieved
                            ? "text-vesna-green-dark"
                            : "text-tg-hint"
                      }`}
                    >
                      {level.level}
                    </span>
                    <span
                      className={`text-sm ${
                        isCurrentLevel
                          ? "font-semibold text-tg-text"
                          : isAchieved
                            ? "text-tg-text"
                            : "text-tg-hint"
                      }`}
                    >
                      {level.name}
                    </span>
                    {isCurrentLevel && (
                      <Badge variant="tier">Текущий</Badge>
                    )}
                  </div>
                  <span className="text-xs text-tg-hint">
                    {level.xpRequired} XP
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
