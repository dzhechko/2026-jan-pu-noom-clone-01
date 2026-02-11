"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";

function AcceptContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get token from URL or Telegram start_param
  const urlToken = searchParams.get("token");

  // Check Telegram startapp param for duel_ prefix
  let telegramToken: string | null = null;
  if (typeof window !== "undefined") {
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { initDataUnsafe?: { start_param?: string } } } }).Telegram;
      const startParam = tg?.WebApp?.initDataUnsafe?.start_param;
      if (startParam?.startsWith("duel_")) {
        telegramToken = startParam.slice(5); // remove "duel_" prefix
      }
    } catch {
      // Not in Telegram context
    }
  }

  const inviteToken = urlToken || telegramToken;

  useEffect(() => {
    // If not authenticated, store token and redirect to login
    if (!authLoading && !user && inviteToken) {
      sessionStorage.setItem("vesna_pending_duel_token", inviteToken);
      router.push("/login");
    }
  }, [authLoading, user, inviteToken, router]);

  // On mount, check for stored token (returning from login)
  useEffect(() => {
    if (user && !inviteToken) {
      const stored = sessionStorage.getItem("vesna_pending_duel_token");
      if (stored) {
        sessionStorage.removeItem("vesna_pending_duel_token");
        router.push(`/duels/accept?token=${stored}`);
      }
    }
  }, [user, inviteToken, router]);

  const handleAccept = async (): Promise<void> => {
    if (!inviteToken) return;
    setAccepting(true);
    setError(null);

    const { data, error: apiErr } = await api.post<{ duelId: string }>(
      "/api/duels/accept",
      { inviteToken },
      { token },
    );

    if (data) {
      router.push(`/duels/${data.duelId}`);
    } else {
      setError(apiErr?.message ?? "Не удалось принять дуэль");
    }
    setAccepting(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!inviteToken) {
    return (
      <Card className="mx-4 mt-8 text-center">
        <p className="text-sm text-tg-hint">Неверная ссылка на дуэль</p>
        <Button variant="secondary" className="mt-4" onClick={() => router.push("/duels")}>
          К дуэлям
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mx-4 mt-8 text-center">
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-tg-button/10">
        <span className="text-3xl">⚔️</span>
      </div>
      <h2 className="mb-2 text-lg font-bold text-tg-text">Вас вызвали на дуэль!</h2>
      <p className="mb-4 text-sm text-tg-hint">
        7 дней соревнования: уроки, питание и серии
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <Button onClick={handleAccept} loading={accepting} className="w-full">
        Принять вызов
      </Button>
    </Card>
  );
}

export default function AcceptPage(): React.JSX.Element {
  return (
    <AppShell title="Приглашение" showBack showNav={false}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        }
      >
        <AcceptContent />
      </Suspense>
    </AppShell>
  );
}
