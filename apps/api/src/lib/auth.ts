import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { SubscriptionTier } from "@prisma/client";
import { apiError } from "./errors";

// --- Types ---

export interface TokenPayload {
  sub: string;
  tier: SubscriptionTier;
}

interface RefreshPayload extends TokenPayload {
  type: "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  userId: string;
  tier: SubscriptionTier;
}

// --- Key management (cached) ---

let _privateKey: string | null = null;
let _publicKey: string | null = null;

function getPrivateKey(): string {
  if (!_privateKey) {
    const raw = process.env.JWT_SECRET;
    if (!raw) throw new Error("JWT_SECRET env var is not set");
    _privateKey = raw.replace(/\\n/g, "\n");
  }
  return _privateKey;
}

function getPublicKey(): string {
  if (!_publicKey) {
    const raw = process.env.JWT_PUBLIC_KEY;
    if (!raw) throw new Error("JWT_PUBLIC_KEY env var is not set");
    _publicKey = raw.replace(/\\n/g, "\n");
  }
  return _publicKey;
}

// --- Token operations ---

export function signTokens(payload: TokenPayload): AuthTokens {
  const privateKey = getPrivateKey();

  const accessToken = jwt.sign(
    { sub: payload.sub, tier: payload.tier },
    privateKey,
    { algorithm: "RS256", expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { sub: payload.sub, tier: payload.tier, type: "refresh" },
    privateKey,
    { algorithm: "RS256", expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  const publicKey = getPublicKey();
  const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload;
  return { sub: decoded.sub as string, tier: decoded.tier as SubscriptionTier };
}

export function verifyRefreshToken(token: string): TokenPayload {
  const publicKey = getPublicKey();
  const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as jwt.JwtPayload & { type?: string };

  if (decoded.type !== "refresh") {
    throw new Error("Token is not a refresh token");
  }

  return { sub: decoded.sub as string, tier: decoded.tier as SubscriptionTier };
}

// --- Password operations ---

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Dummy hash for timing-attack protection (used when user not found)
const DUMMY_HASH = "$2a$12$000000000000000000000uGBHRn5eY0Rlgr4.hMdWzNBi/IxOHOq";

export async function dummyCompare(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

// --- Route-level auth helper ---

export function requireAuth(request: Request):
  | { user: AuthUser }
  | { error: ReturnType<typeof apiError> } {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return { error: apiError("AUTH_001") };
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    return { user: { userId: payload.sub, tier: payload.tier } };
  } catch {
    return { error: apiError("AUTH_001") };
  }
}
