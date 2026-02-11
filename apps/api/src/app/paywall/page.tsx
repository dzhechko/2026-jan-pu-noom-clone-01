"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import type { SubscriptionStatus, TrialInfo } from "@vesna/shared";

const FEATURES_COMPARISON = [
  { feature: "CBT-уроки", free: "3 урока", premium: "Все 14 уроков" },
  { feature: "AI-коуч", free: "—", premium: "Безлимитный доступ" },
  { feature: "Дуэли с друзьями", free: "—", premium: "Доступно" },
  { feature: "Трекер питания", free: "Доступно", premium: "Доступно" },
  { feature: "Геймификация", free: "Базовая", premium: "Полная" },
];

const HERO_TEXT: Record<string, { title: string; subtitle: string }> = {
  lesson: {
    title: "Продолжите свой путь к здоровью",
    subtitle: "Разблокируйте все возможности Весны",
  },
  coach: {
    title: "Ваш персональный AI-коуч ждёт",
    subtitle: "Персональные CBT-рекомендации каждый день",
  },
  duel: {
    title: "Соревнуйтесь с друзьями",
    subtitle: "7-дневные дуэли за здоровый образ жизни",
  },
  default: {
    title: "Откройте Premium-возможности",
    subtitle: "Всё для управления весом в одном месте",
  },
};

function PaywallContent(): JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token } = useAuth();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = searchParams.get("source") ?? "default";
  const hero = HERO_TEXT[source] ?? HERO_TEXT.default;

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await api.get<{
        subscription: SubscriptionStatus;
        trial: TrialInfo;
      }>("/api/subscription/status", { token });
      if (data) {
        // Already premium — redirect to subscription management
        if (data.subscription.status === "active" || data.subscription.status === "trial") {
          router.replace("/profile/subscription");
          return;
        }
        setSubscription(data.subscription);
        setTrial(data.trial);
      }
      setLoading(false);
    })();
  }, [token, router]);

  const handleStartTrial = async (): Promise<void> => {
    setActing(true);
    setError(null);
    const { data, error: err } = await api.post<{ subscription: SubscriptionStatus }>(
      "/api/subscription/trial",
      {},
      { token },
    );
    if (data) {
      router.replace(source === "lesson" ? `/lessons/${searchParams.get("blocked") ?? ""}` : "/");
    } else if (err) {
      setError(err.message);
    }
    setActing(false);
  };

  const handlePay = async (): Promise<void> => {
    setActing(true);
    setError(null);
    const { data, error: err } = await api.post<{
      invoice: { invoiceUrl: string };
    }>("/api/subscription/invoice", {}, { token });
    if (data) {
      // Open Telegram Stars payment
      if (typeof window !== "undefined" && window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(data.invoice.invoiceUrl);
      } else {
        window.open(data.invoice.invoiceUrl, "_blank");
      }
    } else if (err) {
      setError(err.message);
    }
    setActing(false);
  };

  if (loading) {
    return (
      <AppShell title="Premium" showBack>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Premium" showBack>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Hero */}
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-tg-button/10">
            <span className="text-4xl">
              {source === "coach" ? "🤖" : source === "duel" ? "⚔️" : "⭐"}
            </span>
          </div>
          <h1 className="mb-2 text-xl font-bold text-tg-text">{hero.title}</h1>
          <p className="text-sm text-tg-hint">{hero.subtitle}</p>
        </div>

        {/* Feature comparison */}
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tg-hint/20">
                <th className="pb-2 text-left font-medium text-tg-hint">Функция</th>
                <th className="pb-2 text-center font-medium text-tg-hint">Free</th>
                <th className="pb-2 text-center font-medium text-tg-button">Premium</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES_COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-tg-hint/10 last:border-0">
                  <td className="py-2 text-tg-text">{row.feature}</td>
                  <td className="py-2 text-center text-tg-hint">{row.free}</td>
                  <td className="py-2 text-center font-medium text-tg-text">{row.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* CTA */}
        <div className="flex flex-col gap-3">
          {trial?.eligible && (
            <Button onClick={handleStartTrial} loading={acting} size="lg" className="w-full">
              Попробовать 7 дней бесплатно
            </Button>
          )}

          <Button
            onClick={handlePay}
            loading={acting}
            variant={trial?.eligible ? "secondary" : "primary"}
            size="lg"
            className="w-full"
          >
            Оплатить 250 Stars/мес
          </Button>

          <p className="text-center text-xs text-tg-hint">
            250 Stars ≈ 499 руб. Оплата через Telegram Stars.
          </p>

          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}
        </div>

        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mx-auto"
        >
          Не сейчас
        </Button>
      </div>
    </AppShell>
  );
}

export default function PaywallPage(): JSX.Element {
  return (
    <Suspense
      fallback={
        <AppShell title="Premium" showBack>
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        </AppShell>
      }
    >
      <PaywallContent />
    </Suspense>
  );
}

