"use client";

import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DuelInviteCard } from "@/components/duels/duel-invite-card";
import { DuelScoreboardCard } from "@/components/duels/duel-scoreboard-card";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import type { DuelListItem, DuelScoreboard, DuelCreateResult } from "@vesna/shared";

export default function DuelsPage(): React.JSX.Element {
  const { user, token } = useAuth();
  const [duels, setDuels] = useState<DuelListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [pendingDuel, setPendingDuel] = useState<DuelCreateResult | null>(null);
  const [activeScoreboard, setActiveScoreboard] = useState<DuelScoreboard | null>(null);

  const isFree = user?.subscriptionTier === "free";

  const loadDuels = useCallback(async () => {
    const { data } = await api.get<{ duels: DuelListItem[] }>("/api/duels", { token });
    if (data) {
      setDuels(data.duels);

      // Check for pending duel
      const pending = data.duels.find((d) => d.status === "pending");
      if (pending) {
        // We need to re-derive inviteLink from the API; for now show as pending state
        setPendingDuel(null);
      }

      // Check for active duel
      const active = data.duels.find((d) => d.status === "active");
      if (active) {
        const { data: sbData } = await api.get<{ scoreboard: DuelScoreboard }>(
          `/api/duels/${active.id}/scoreboard`,
          { token },
        );
        if (sbData) setActiveScoreboard(sbData.scoreboard);
      }
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadDuels();
  }, [token, loadDuels]);

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    const { data, error } = await api.post<DuelCreateResult>("/api/duels/create", {}, { token });
    if (data) {
      setPendingDuel(data);
      await loadDuels();
    } else if (error) {
      alert(error.message);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <AppShell title="Дуэли" showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  // Free user — premium CTA
  if (isFree) {
    return (
      <AppShell title="Дуэли" showNav>
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <Card className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-tg-button/10">
              <span className="text-3xl">⚔️</span>
            </div>
            <h2 className="mb-2 text-lg font-bold text-tg-text">Дуэли</h2>
            <p className="mb-4 text-sm text-tg-hint">
              Соревнуйтесь с друзьями! Кто лучше следит за здоровьем в течение 7 дней?
            </p>
            <Badge variant="tier">Premium</Badge>
            <p className="mt-3 text-xs text-tg-hint">
              Дуэли доступны в Premium-подписке
            </p>
          </Card>
        </div>
      </AppShell>
    );
  }

  const hasPendingOrActive = duels.some((d) => d.status === "pending" || d.status === "active");
  const completedDuels = duels.filter((d) => d.status === "completed" || d.status === "expired");

  return (
    <AppShell title="Дуэли" showNav>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Pending invite card */}
        {pendingDuel && (
          <DuelInviteCard
            inviteLink={pendingDuel.inviteLink}
            expiresAt={pendingDuel.expiresAt}
          />
        )}

        {/* Active duel scoreboard */}
        {activeScoreboard && activeScoreboard.status === "active" && (
          <DuelScoreboardCard scoreboard={activeScoreboard} />
        )}

        {/* Create button when no active/pending duel */}
        {!hasPendingOrActive && !pendingDuel && (
          <Card className="w-full text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-tg-button/10">
              <span className="text-3xl">⚔️</span>
            </div>
            <h3 className="mb-1 text-base font-bold text-tg-text">Вызвать друга</h3>
            <p className="mb-4 text-sm text-tg-hint">
              7-дневная дуэль: уроки, питание и серии приносят очки
            </p>
            <Button onClick={handleCreate} loading={creating} className="w-full">
              Создать дуэль
            </Button>
          </Card>
        )}

        {/* History */}
        {completedDuels.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-tg-hint">История</h3>
            <div className="flex flex-col gap-2">
              {completedDuels.map((duel) => (
                <Card key={duel.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-tg-text">
                      {duel.challengerName} vs {duel.opponentName ?? "—"}
                    </p>
                    <p className="text-xs text-tg-hint">
                      {duel.challengerScore} — {duel.opponentScore}
                      {duel.status === "expired" && " (истекла)"}
                    </p>
                  </div>
                  {duel.winnerId && (
                    <Badge variant={duel.winnerId === user?.id ? "xp" : "default"}>
                      {duel.winnerId === user?.id ? "Победа" : "Поражение"}
                    </Badge>
                  )}
                  {!duel.winnerId && duel.status === "completed" && (
                    <Badge variant="default">Ничья</Badge>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
