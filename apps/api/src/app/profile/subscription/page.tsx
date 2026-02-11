"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api-client";
import type { SubscriptionStatus, TrialInfo } from "@vesna/shared";

const STATUS_LABELS: Record<string, string> = {
  free: "Бесплатный",
  trial: "Пробный период",
  active: "Активная",
  cancelled: "Отменена",
  expired: "Истекла",
};

const STATUS_COLORS: Record<string, string> = {
  free: "default",
  trial: "tier",
  active: "xp",
  cancelled: "default",
  expired: "default",
};

export default function SubscriptionPage(): JSX.Element {
  const router = useRouter();
  const { token } = useAuth();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data } = await api.get<{
        subscription: SubscriptionStatus;
        trial: TrialInfo;
      }>("/api/subscription/status", { token });
      if (data) {
        setSubscription(data.subscription);
        setTrial(data.trial);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleCancel = async (): Promise<void> => {
    if (!confirm("Вы уверены? Доступ сохранится до конца оплаченного периода.")) return;
    setCancelling(true);
    const { data, error } = await api.post<{ subscription: SubscriptionStatus }>(
      "/api/subscription/cancel",
      {},
      { token },
    );
    if (data) {
      setSubscription(data.subscription);
    } else if (error) {
      alert(error.message);
    }
    setCancelling(false);
  };

  const handleRenew = (): void => {
    router.push("/paywall");
  };

  if (loading) {
    return (
      <AppShell title="Подписка" showBack>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!subscription) {
    return (
      <AppShell title="Подписка" showBack>
        <div className="px-4 py-8 text-center text-tg-hint">
          Не удалось загрузить информацию о подписке
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Подписка" showBack>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Status card */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-tg-text">Статус подписки</h2>
            <Badge variant={STATUS_COLORS[subscription.status] as "default" | "tier" | "xp"}>
              {STATUS_LABELS[subscription.status] ?? subscription.status}
            </Badge>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-tg-hint">Тариф</span>
              <span className="font-medium text-tg-text capitalize">{subscription.tier}</span>
            </div>

            {subscription.expiresAt && (
              <div className="flex justify-between">
                <span className="text-tg-hint">
                  {subscription.status === "cancelled" ? "Доступ до" : "Действует до"}
                </span>
                <span className="font-medium text-tg-text">
                  {new Date(subscription.expiresAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            )}

            {subscription.daysRemaining > 0 && (
              <div className="flex justify-between">
                <span className="text-tg-hint">Осталось</span>
                <span className="font-medium text-tg-text">
                  {subscription.daysRemaining} {subscription.daysRemaining === 1 ? "день" : subscription.daysRemaining < 5 ? "дня" : "дней"}
                </span>
              </div>
            )}

            {subscription.cancelledAt && (
              <div className="flex justify-between">
                <span className="text-tg-hint">Отменена</span>
                <span className="text-tg-text">
                  {new Date(subscription.cancelledAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Features */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-hint">Ваши возможности</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span>{subscription.features.maxLessons >= 14 ? "✅" : "🔒"}</span>
              <span className="text-tg-text">
                Уроки: {subscription.features.maxLessons} из 14
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span>{subscription.features.hasCoach ? "✅" : "🔒"}</span>
              <span className="text-tg-text">AI-коуч</span>
            </div>
            <div className="flex items-center gap-2">
              <span>{subscription.features.hasDuels ? "✅" : "🔒"}</span>
              <span className="text-tg-text">Дуэли с друзьями</span>
            </div>
          </div>
        </Card>

        {/* Lost features on cancel */}
        {subscription.lostFeatures && subscription.lostFeatures.length > 0 && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-red-500">
              После отмены вы потеряете:
            </h3>
            <div className="space-y-2 text-sm">
              {subscription.lostFeatures.map((f) => (
                <div key={f.name} className="flex items-center gap-2">
                  <span>❌</span>
                  <div>
                    <span className="font-medium text-tg-text">{f.name}</span>
                    <span className="ml-1 text-tg-hint">— {f.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {(subscription.status === "free" || subscription.status === "expired") && (
            <Button onClick={handleRenew} size="lg" className="w-full">
              {trial?.eligible ? "Попробовать 7 дней бесплатно" : "Оплатить 250 Stars/мес"}
            </Button>
          )}

          {subscription.status === "cancelled" && (
            <Button onClick={handleRenew} size="lg" className="w-full">
              Возобновить подписку
            </Button>
          )}

          {subscription.status === "active" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              loading={cancelling}
              className="mx-auto text-red-500"
            >
              Отменить подписку
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
