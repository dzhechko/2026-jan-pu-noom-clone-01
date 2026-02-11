"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DuelsPage(): React.JSX.Element {
  return (
    <AppShell title="Дуэли" showNav>
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <Card className="w-full max-w-sm text-center">
          {/* Coming soon illustration */}
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-tg-secondary-bg">
            <svg
              className="h-10 w-10 text-tg-hint"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
              />
            </svg>
          </div>

          <Badge variant="tier" className="mb-3">
            Скоро
          </Badge>

          <h2 className="mb-2 text-lg font-bold text-tg-text">
            Дуэли
          </h2>
          <p className="text-sm leading-relaxed text-tg-hint">
            Скоро вы сможете вызывать друзей на дуэли по управлению весом.
            Соревнуйтесь в выполнении привычек и зарабатывайте бонусные очки!
          </p>

          <div className="mt-6 rounded-xl bg-tg-secondary-bg p-4">
            <h3 className="mb-2 text-xs font-semibold text-tg-text">
              Что будет доступно:
            </h3>
            <ul className="flex flex-col gap-1.5 text-left text-xs text-tg-hint">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vesna-green" />
                7-дневные дуэли с друзьями
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vesna-green" />
                Очки за уроки, питание и серии
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vesna-green" />
                Бонусные XP за победу
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vesna-green" />
                Приглашение через Telegram
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
