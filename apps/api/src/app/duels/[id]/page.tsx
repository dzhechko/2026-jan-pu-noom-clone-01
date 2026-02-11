"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DuelScoreboardCard } from "@/components/duels/duel-scoreboard-card";
import { DuelResultCard } from "@/components/duels/duel-result-card";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import type { DuelScoreboard } from "@vesna/shared";

export default function DuelDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const [scoreboard, setScoreboard] = useState<DuelScoreboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !params.id) return;

    api
      .get<{ scoreboard: DuelScoreboard }>(`/api/duels/${params.id}/scoreboard`, { token })
      .then(({ data, error: apiErr }) => {
        if (data) {
          setScoreboard(data.scoreboard);
        } else {
          setError(apiErr?.message ?? "Не удалось загрузить дуэль");
        }
      })
      .finally(() => setLoading(false));
  }, [token, params.id]);

  if (loading) {
    return (
      <AppShell title="Дуэль" showBack showNav>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !scoreboard) {
    return (
      <AppShell title="Дуэль" showBack showNav>
        <div className="px-4 py-8">
          <Card className="text-center">
            <p className="text-sm text-tg-hint">{error ?? "Дуэль не найдена"}</p>
            <Button variant="secondary" className="mt-4" onClick={() => window.history.back()}>
              Назад
            </Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Дуэль" showBack showNav>
      <div className="flex flex-col gap-4 px-4 py-4">
        {scoreboard.status === "completed" && user ? (
          <DuelResultCard scoreboard={scoreboard} currentUserId={user.id} />
        ) : (
          <DuelScoreboardCard scoreboard={scoreboard} />
        )}
      </div>
    </AppShell>
  );
}
