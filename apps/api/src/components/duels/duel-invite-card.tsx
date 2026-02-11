"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DuelInviteCardProps {
  inviteLink: string;
  expiresAt: string;
  botUsername?: string;
}

function formatExpiry(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Истекло";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}ч ${minutes}мин`;
}

export function DuelInviteCard({
  inviteLink,
  expiresAt,
  botUsername = "vesna_bot",
}: DuelInviteCardProps): React.JSX.Element {
  const [expiry, setExpiry] = useState(formatExpiry(expiresAt));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setExpiry(formatExpiry(expiresAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const fullLink = `https://t.me/${botUsername}?startapp=${inviteLink}`;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt
    }
  };

  const handleTelegramShare = (): void => {
    const text = encodeURIComponent("Вызываю тебя на дуэль в Весне! Кто лучше следит за здоровьем? 💪");
    const url = encodeURIComponent(fullLink);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
  };

  return (
    <Card className="w-full">
      <div className="mb-3 text-center">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-tg-button/10">
          <svg className="h-8 w-8 text-tg-button" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-1.135a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.343 8.25" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-tg-text">Дуэль создана!</h3>
        <p className="mt-1 text-sm text-tg-hint">
          Отправьте ссылку другу, чтобы начать
        </p>
      </div>

      {/* Expiry */}
      <div className="mb-4 rounded-lg bg-tg-bg px-3 py-2 text-center">
        <span className="text-xs text-tg-hint">Ссылка действует: </span>
        <span className="text-xs font-semibold text-tg-text">{expiry}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button onClick={handleTelegramShare} className="w-full">
          Отправить в Telegram
        </Button>
        <Button variant="secondary" onClick={handleCopy} className="w-full">
          {copied ? "Скопировано!" : "Копировать ссылку"}
        </Button>
      </div>
    </Card>
  );
}
