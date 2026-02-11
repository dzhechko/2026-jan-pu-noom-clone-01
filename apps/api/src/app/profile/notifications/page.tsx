"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import type { NotificationPrefs } from "@vesna/shared";

interface PrefsResponse {
  preferences: NotificationPrefs;
  timezone: string;
}

const RUSSIAN_TIMEZONES = [
  { value: "Europe/Kaliningrad", label: "Калининград (UTC+2)" },
  { value: "Europe/Moscow", label: "Москва (UTC+3)" },
  { value: "Europe/Samara", label: "Самара (UTC+4)" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург (UTC+5)" },
  { value: "Asia/Omsk", label: "Омск (UTC+6)" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск (UTC+7)" },
  { value: "Asia/Irkutsk", label: "Иркутск (UTC+8)" },
  { value: "Asia/Yakutsk", label: "Якутск (UTC+9)" },
  { value: "Asia/Vladivostok", label: "Владивосток (UTC+10)" },
  { value: "Asia/Kamchatka", label: "Камчатка (UTC+12)" },
];

export default function NotificationSettingsPage(): React.JSX.Element {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [timezone, setTimezone] = useState("Europe/Moscow");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get<PrefsResponse>("/api/notifications/preferences")
      .then((res) => {
        if (res.data) {
          setPrefs(res.data.preferences);
          setTimezone(res.data.timezone);
        } else {
          setError(res.error?.message ?? "Не удалось загрузить настройки");
        }
      })
      .catch(() => {
        setError("Не удалось загрузить настройки");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(): Promise<void> {
    if (!prefs) return;
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await api.patch<PrefsResponse>("/api/notifications/preferences", {
      ...prefs,
      timezone,
    });

    if (res.data) {
      setPrefs(res.data.preferences);
      setTimezone(res.data.timezone);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(res.error?.message ?? "Не удалось сохранить");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <AppShell title="Уведомления" showBack>
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !prefs) {
    return (
      <AppShell title="Уведомления" showBack>
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-20">
          <p className="text-sm text-vesna-red">{error}</p>
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

  if (!prefs) return <></>;

  function updatePref(key: keyof NotificationPrefs, value: boolean): void {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <AppShell title="Уведомления" showBack>
      <div className="flex flex-col gap-4 px-4 py-6">
        {/* Notification types */}
        <Card>
          <h3 className="mb-1 text-sm font-semibold text-tg-text">
            Типы уведомлений
          </h3>
          <div className="divide-y divide-tg-hint/10">
            <Toggle
              label="Напоминания об уроках"
              description="Ежедневно в 10:00"
              checked={prefs.lessonReminder}
              onChange={(v) => updatePref("lessonReminder", v)}
            />
            <Toggle
              label="Риск потери серии"
              description="В 20:00, если серия > 2 дней"
              checked={prefs.streakRisk}
              onChange={(v) => updatePref("streakRisk", v)}
            />
            <Toggle
              label="Напоминания о возвращении"
              description="Через 2, 5 и 14 дней неактивности"
              checked={prefs.churnPrevention}
              onChange={(v) => updatePref("churnPrevention", v)}
            />
            <Toggle
              label="События дуэлей"
              description="Принятие и завершение дуэлей"
              checked={prefs.duelEvents}
              onChange={(v) => updatePref("duelEvents", v)}
            />
            <Toggle
              label="Еженедельный отчёт"
              description="Воскресенье в 18:00"
              checked={prefs.weeklyReport}
              onChange={(v) => updatePref("weeklyReport", v)}
            />
          </div>
        </Card>

        {/* Timezone */}
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-tg-text">
            Часовой пояс
          </h3>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-xl border border-tg-hint/20 bg-tg-bg px-3 py-2.5 text-sm text-tg-text focus:outline-none focus:ring-2 focus:ring-tg-button/50"
          >
            {RUSSIAN_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </Card>

        {/* Quiet hours info */}
        <Card className="bg-tg-hint/5">
          <h3 className="mb-1 text-sm font-semibold text-tg-text">
            Тихие часы
          </h3>
          <p className="text-xs text-tg-hint">
            Уведомления не отправляются с 22:00 до 08:00 по вашему времени.
            Максимум 3 уведомления в день.
          </p>
        </Card>

        {/* Error */}
        {error && (
          <p className="text-center text-sm text-vesna-red">{error}</p>
        )}

        {/* Save button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={saving}
          onClick={handleSave}
        >
          {saved ? "Сохранено!" : "Сохранить"}
        </Button>
      </div>
    </AppShell>
  );
}
