import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { apiError, type ErrorCode } from "@/lib/errors";
import {
  DUEL_DURATION_DAYS,
  DUEL_INVITE_EXPIRY_HOURS,
  MAX_ACTIVE_DUELS,
  DUEL_SCORE_POINTS,
  DUEL_XP_REWARDS,
  DUEL_WINNER_BADGE,
  SUBSCRIPTION_TIERS,
} from "@vesna/shared";
import type { DuelAction, DuelScoreboard, DuelListItem, DuelCreateResult } from "@vesna/shared";
import type { SubscriptionTier } from "@prisma/client";
import { calculateLevel } from "./gamification-engine";

// --- Error class ---

export class DuelError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    const { body } = apiError(code);
    super(body.error.message);
    this.code = code;
  }
}

// --- Pure functions ---

export function generateInviteToken(): string {
  return crypto.randomBytes(16).toString("hex"); // 32 hex chars
}

export function calculateDuelDates(acceptDate: Date): { startDate: Date; endDate: Date } {
  const startDate = new Date(acceptDate);
  const endDate = new Date(acceptDate);
  endDate.setDate(endDate.getDate() + DUEL_DURATION_DAYS);
  return { startDate, endDate };
}

export function calculateExpiresAt(): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + DUEL_INVITE_EXPIRY_HOURS);
  return expiresAt;
}

export function getScorePoints(action: DuelAction): number {
  return DUEL_SCORE_POINTS[action] ?? 0;
}

export function determineWinner(
  challengerId: string,
  opponentId: string,
  challengerScore: number,
  opponentScore: number,
): string | null {
  if (challengerScore > opponentScore) return challengerId;
  if (opponentScore > challengerScore) return opponentId;
  return null; // tie
}

// --- DB-dependent functions ---

export async function createDuel(
  challengerId: string,
  tier: SubscriptionTier,
): Promise<DuelCreateResult> {
  // Check premium
  if (!SUBSCRIPTION_TIERS[tier].hasDuels) {
    throw new DuelError("DUEL_001");
  }

  // Check no active duel
  const activeCount = await prisma.duel.count({
    where: {
      OR: [
        { challengerId, status: { in: ["pending", "active"] } },
        { opponentId: challengerId, status: { in: ["pending", "active"] } },
      ],
    },
  });

  if (activeCount >= MAX_ACTIVE_DUELS) {
    throw new DuelError("DUEL_003");
  }

  const inviteToken = generateInviteToken();
  const expiresAt = calculateExpiresAt();

  const duel = await prisma.duel.create({
    data: {
      challengerId,
      inviteToken,
      status: "pending",
      expiresAt,
    },
  });

  return {
    duelId: duel.id,
    inviteToken,
    inviteLink: `duel_${inviteToken}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function acceptDuel(
  inviteToken: string,
  opponentId: string,
): Promise<{ duelId: string }> {
  const duel = await prisma.duel.findUnique({
    where: { inviteToken },
  });

  if (!duel) {
    throw new DuelError("DUEL_002");
  }

  if (duel.status !== "pending") {
    throw new DuelError("DUEL_002");
  }

  if (duel.expiresAt < new Date()) {
    // Auto-expire
    await prisma.duel.update({
      where: { id: duel.id },
      data: { status: "expired" },
    });
    throw new DuelError("DUEL_002");
  }

  // Can't duel yourself
  if (duel.challengerId === opponentId) {
    throw new DuelError("DUEL_003");
  }

  // Check opponent doesn't have an active duel
  const opponentActiveCount = await prisma.duel.count({
    where: {
      OR: [
        { challengerId: opponentId, status: { in: ["pending", "active"] } },
        { opponentId, status: { in: ["pending", "active"] } },
      ],
    },
  });

  if (opponentActiveCount >= MAX_ACTIVE_DUELS) {
    throw new DuelError("DUEL_003");
  }

  const { startDate, endDate } = calculateDuelDates(new Date());

  await prisma.duel.update({
    where: { id: duel.id },
    data: {
      opponentId,
      status: "active",
      startDate,
      endDate,
    },
  });

  return { duelId: duel.id };
}

export async function getScoreboard(
  duelId: string,
  userId: string,
): Promise<DuelScoreboard> {
  // Try Redis cache first
  const cacheKey = `duel:scoreboard:${duelId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — fall through to DB
  }

  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
    include: {
      challenger: { select: { id: true, name: true } },
      opponent: { select: { id: true, name: true } },
    },
  });

  if (!duel) {
    throw new DuelError("DUEL_002");
  }

  // Check the user is a participant
  if (duel.challengerId !== userId && duel.opponentId !== userId) {
    throw new DuelError("DUEL_002");
  }

  // Lazy completion: if active duel has ended, complete it
  if (duel.status === "active" && duel.endDate && duel.endDate < new Date()) {
    await completeDuel(duel.id);
    // Re-fetch after completion
    return getScoreboard(duelId, userId);
  }

  const now = new Date();
  const remainingMs = duel.endDate
    ? Math.max(0, duel.endDate.getTime() - now.getTime())
    : 0;

  const scoreboard: DuelScoreboard = {
    duelId: duel.id,
    status: duel.status as DuelScoreboard["status"],
    challenger: {
      userId: duel.challenger.id,
      name: duel.challenger.name,
      score: duel.challengerScore,
    },
    opponent: {
      userId: duel.opponent?.id ?? "",
      name: duel.opponent?.name ?? "Ожидание...",
      score: duel.opponentScore,
    },
    startDate: duel.startDate?.toISOString() ?? "",
    endDate: duel.endDate?.toISOString() ?? "",
    winnerId: duel.winnerId,
    remainingMs,
  };

  // Cache for 30 seconds
  try {
    await redis.setex(cacheKey, 30, JSON.stringify(scoreboard));
  } catch {
    // Redis unavailable — skip cache
  }

  return scoreboard;
}

export async function updateDuelScore(
  userId: string,
  action: DuelAction,
): Promise<void> {
  // Find user's active duel
  const duel = await prisma.duel.findFirst({
    where: {
      status: "active",
      OR: [
        { challengerId: userId },
        { opponentId: userId },
      ],
    },
  });

  if (!duel) return; // No active duel — silently skip

  // For streak_maintained: dedup per day
  if (action === "streak_maintained") {
    const today = new Date().toISOString().slice(0, 10);
    const dedupKey = `duel:streak:${userId}:${today}`;
    try {
      const alreadyCounted = await redis.get(dedupKey);
      if (alreadyCounted) return;
      // Set with expiry at end of day (24h is safe enough)
      await redis.setex(dedupKey, 86400, "1");
    } catch {
      // Redis unavailable — skip dedup, allow duplicate
    }
  }

  const points = getScorePoints(action);
  if (points === 0) return;

  const isChallenger = duel.challengerId === userId;
  const scoreField = isChallenger ? "challengerScore" : "opponentScore";

  await prisma.duel.update({
    where: { id: duel.id },
    data: { [scoreField]: { increment: points } },
  });

  // Invalidate scoreboard cache
  try {
    await redis.del(`duel:scoreboard:${duel.id}`);
  } catch {
    // Redis unavailable
  }
}

export async function completeDuel(duelId: string): Promise<void> {
  const duel = await prisma.duel.findUnique({
    where: { id: duelId },
  });

  if (!duel || duel.status !== "active") return;

  const winnerId = determineWinner(
    duel.challengerId,
    duel.opponentId!,
    duel.challengerScore,
    duel.opponentScore,
  );

  // Transaction: update duel + award XP + badge
  await prisma.$transaction(async (tx) => {
    await tx.duel.update({
      where: { id: duelId },
      data: { status: "completed", winnerId },
    });

    // Award participation XP to both players
    const playerIds = [duel.challengerId, duel.opponentId!];
    for (const playerId of playerIds) {
      const xp = playerId === winnerId
        ? DUEL_XP_REWARDS.winner + DUEL_XP_REWARDS.participation
        : DUEL_XP_REWARDS.participation;

      const gamification = await tx.gamification.upsert({
        where: { userId: playerId },
        create: { userId: playerId, xpTotal: xp, level: 1 },
        update: { xpTotal: { increment: xp } },
      });

      const newLevel = calculateLevel(gamification.xpTotal);
      if (newLevel.level !== gamification.level) {
        await tx.gamification.update({
          where: { userId: playerId },
          data: { level: newLevel.level },
        });
      }
    }

    // Award badge to winner
    if (winnerId) {
      const winnerGamification = await tx.gamification.findUnique({
        where: { userId: winnerId },
      });

      if (winnerGamification) {
        const badges = (winnerGamification.badges as string[]) || [];
        if (!badges.includes(DUEL_WINNER_BADGE)) {
          badges.push(DUEL_WINNER_BADGE);
          await tx.gamification.update({
            where: { userId: winnerId },
            data: { badges },
          });
        }
      }
    }
  });

  // Invalidate cache
  try {
    await redis.del(`duel:scoreboard:${duelId}`);
  } catch {
    // Redis unavailable
  }
}

export async function expirePendingDuels(): Promise<number> {
  const result = await prisma.duel.updateMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
  return result.count;
}

export async function completeEndedDuels(): Promise<number> {
  const endedDuels = await prisma.duel.findMany({
    where: {
      status: "active",
      endDate: { lt: new Date() },
    },
    select: { id: true },
  });

  for (const duel of endedDuels) {
    await completeDuel(duel.id);
  }

  return endedDuels.length;
}

export async function getUserDuels(userId: string): Promise<DuelListItem[]> {
  const duels = await prisma.duel.findMany({
    where: {
      OR: [
        { challengerId: userId },
        { opponentId: userId },
      ],
    },
    include: {
      challenger: { select: { name: true } },
      opponent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Lazy completion for any active duels that have ended
  for (const duel of duels) {
    if (duel.status === "active" && duel.endDate && duel.endDate < new Date()) {
      await completeDuel(duel.id);
    }
  }

  // Re-fetch if any were completed
  const hasCompleted = duels.some(
    (d) => d.status === "active" && d.endDate && d.endDate < new Date(),
  );
  const finalDuels = hasCompleted
    ? await prisma.duel.findMany({
        where: {
          OR: [
            { challengerId: userId },
            { opponentId: userId },
          ],
        },
        include: {
          challenger: { select: { name: true } },
          opponent: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : duels;

  return finalDuels.map((duel) => ({
    id: duel.id,
    status: duel.status as DuelListItem["status"],
    challengerName: duel.challenger.name,
    opponentName: duel.opponent?.name ?? null,
    challengerScore: duel.challengerScore,
    opponentScore: duel.opponentScore,
    winnerId: duel.winnerId,
    createdAt: duel.createdAt.toISOString(),
    endDate: duel.endDate?.toISOString() ?? null,
  }));
}
