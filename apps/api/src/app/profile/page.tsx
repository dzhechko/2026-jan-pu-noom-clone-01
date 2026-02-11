"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import Link from "next/link";
import { GAMIFICATION_LEVELS } from "@vesna/shared";

interface UserData {
  name: string | null;
  email: string | null;
  telegramId: string | null;
  subscriptionTier: string;
}

interface ProfileResponse {
  user: UserData;
  gamification: {
    xp: number;
    level: number;
    badges: string[];
  } | null;
  streak: {
    current: number;
    longest: number;
  } | null;
}

const tierLabels: Record<string, string> = {
  free: "Бесплатный",
  premium: "Премиум",
  clinical: "Клинический",
};

export default function ProfilePage(): React.JSX.Element {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ProfileResponse>("/api/user/profile")
      .then((res) => {
        if (res.data?.user) {
          setProfile(res.data);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить профиль");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить профиль");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell title="Профиль" showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return (
      <AppShell title="Профиль" showNav>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
          <p className="text-sm text-vesna-red">
            {error ?? "Профиль не найден"}
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

  const displayName = profile.user.name ?? "Пользователь";
  const gamification = profile.gamification ?? { xp: 0, level: 1, badges: [] };
  const streak = profile.streak ?? { current: 0, longest: 0 };

  // Calculate XP progress to next level
  const currentLevelData = GAMIFICATION_LEVELS.find(
    (l) => l.level === gamification.level,
  );
  const nextLevelData = GAMIFICATION_LEVELS.find(
    (l) => l.level === gamification.level + 1,
  );
  const xpForCurrentLevel = currentLevelData?.xpRequired ?? 0;
  const xpForNextLevel = nextLevelData?.xpRequired ?? gamification.xp;
  const xpRange = xpForNextLevel - xpForCurrentLevel;
  const xpInRange = gamification.xp - xpForCurrentLevel;
  const xpProgress = xpRange > 0 ? (xpInRange / xpRange) * 100 : 100;

  return (
    <AppShell title="Профиль" showNav>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* User info */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-tg-button text-tg-button-text text-xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="truncate text-base font-semibold text-tg-text">
                {displayName}
              </h2>
              {profile.user.email && (
                <p className="truncate text-sm text-tg-hint">
                  {profile.user.email}
                </p>
              )}
              {profile.user.telegramId && (
                <p className="text-xs text-tg-hint">
                  Telegram ID: {profile.user.telegramId}
                </p>
              )}
            </div>
            <Badge variant="tier">
              {tierLabels[profile.user.subscriptionTier] ?? profile.user.subscriptionTier}
            </Badge>
          </div>
        </Card>

        {/* Gamification stats */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Прогресс
          </h3>

          {/* Level and XP */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-tg-hint">Уровень</p>
              <p className="text-lg font-bold text-tg-text">
                {gamification.level}
              </p>
              <p className="text-xs text-tg-hint">
                {currentLevelData?.name ?? ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-tg-hint">Опыт</p>
              <p className="text-lg font-bold text-vesna-green-dark">
                {gamification.xp} XP
              </p>
              {nextLevelData && (
                <p className="text-xs text-tg-hint">
                  до {nextLevelData.name}: {xpForNextLevel - gamification.xp}
                </p>
              )}
            </div>
          </div>
          <ProgressBar value={xpProgress} />

          {/* Badges */}
          {gamification.badges.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-tg-hint">Значки</p>
              <div className="flex flex-wrap gap-2">
                {gamification.badges.map((badge) => (
                  <Badge key={badge} variant="xp">
                    {badge}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Streak info */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">Серия</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-tg-hint">Текущая</p>
              <p className="text-lg font-bold text-tg-text">
                {streak.current} дней
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-tg-hint">Рекорд</p>
              <p className="text-lg font-bold text-vesna-orange">
                {streak.longest} дней
              </p>
            </div>
          </div>
        </Card>

        {/* Settings */}
        <Card>
          <Link
            href="/profile/notifications"
            className="flex items-center justify-between py-1"
          >
            <div>
              <p className="text-sm font-medium text-tg-text">Уведомления</p>
              <p className="text-xs text-tg-hint">Типы, часовой пояс, тихие часы</p>
            </div>
            <span className="text-tg-hint text-lg">&rsaquo;</span>
          </Link>
        </Card>

        {/* Logout */}
        <Button
          variant="ghost"
          size="md"
          className="mt-4 w-full text-vesna-red"
          onClick={logout}
        >
          Выйти
        </Button>
      </div>
    </AppShell>
  );
}
