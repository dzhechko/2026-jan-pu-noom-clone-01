import { validate, parse } from "@tma.js/init-data-node";

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
}

/**
 * Validates Telegram Mini App initData and extracts user info.
 * Throws if signature is invalid or data has expired.
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): TelegramUser {
  // Validate HMAC signature (throws on failure)
  validate(initData, botToken, { expiresIn: 86400 });

  // Parse the validated data
  const parsed = parse(initData);

  if (!parsed.user) {
    throw new Error("No user data in initData");
  }

  return {
    id: parsed.user.id,
    firstName: parsed.user.first_name,
    lastName: parsed.user.last_name ?? undefined,
    username: parsed.user.username ?? undefined,
    photoUrl: parsed.user.photo_url ?? undefined,
  };
}
