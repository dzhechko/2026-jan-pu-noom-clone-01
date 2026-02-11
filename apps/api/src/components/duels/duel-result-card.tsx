"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DuelScoreboard } from "@vesna/shared";

interface DuelResultCardProps {
  scoreboard: DuelScoreboard;
  currentUserId: string;
}

export function DuelResultCard({ scoreboard, currentUserId }: DuelResultCardProps): React.JSX.Element {
  const { challenger, opponent, winnerId } = scoreboard;
  const isTie = !winnerId;
  const isWinner = winnerId === currentUserId;

  const currentPlayer = challenger.userId === currentUserId ? challenger : opponent;
  const otherPlayer = challenger.userId === currentUserId ? opponent : challenger;

  return (
    <Card className="w-full text-center">
      {/* Result banner */}
      <div className="mb-4">
        {isTie ? (
          <>
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-tg-hint/10">
              <span className="text-3xl">🤝</span>
            </div>
            <h3 className="text-lg font-bold text-tg-text">Ничья!</h3>
            <p className="text-sm text-tg-hint">Вы оба молодцы</p>
          </>
        ) : isWinner ? (
          <>
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-vesna-green/10">
              <span className="text-3xl">🏆</span>
            </div>
            <h3 className="text-lg font-bold text-vesna-green-dark">Победа!</h3>
            <Badge variant="xp" className="mt-1">+130 XP</Badge>
          </>
        ) : (
          <>
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-tg-hint/10">
              <span className="text-3xl">💪</span>
            </div>
            <h3 className="text-lg font-bold text-tg-text">В следующий раз!</h3>
            <Badge variant="xp" className="mt-1">+30 XP</Badge>
          </>
        )}
      </div>

      {/* Final scores */}
      <div className="flex items-center justify-around rounded-xl bg-tg-bg p-4">
        <div className="text-center">
          <p className="text-sm font-medium text-tg-text">{currentPlayer.name}</p>
          <p className="text-2xl font-bold text-tg-button">{currentPlayer.score}</p>
        </div>
        <span className="text-sm font-bold text-tg-hint">—</span>
        <div className="text-center">
          <p className="text-sm font-medium text-tg-text">{otherPlayer.name}</p>
          <p className="text-2xl font-bold text-tg-hint">{otherPlayer.score}</p>
        </div>
      </div>
    </Card>
  );
}
