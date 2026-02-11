export const SUBSCRIPTION_TIERS = {
  free: { maxLessons: 3, hasCoach: false, hasDuels: false },
  premium: { maxLessons: 14, hasCoach: true, hasDuels: true },
  clinical: { maxLessons: 14, hasCoach: true, hasDuels: true },
} as const;

export const GAMIFICATION_LEVELS = [
  { level: 1, name: "Новичок", xpRequired: 0 },
  { level: 2, name: "Ученик", xpRequired: 100 },
  { level: 3, name: "Практик", xpRequired: 400 },
  { level: 4, name: "Мастер", xpRequired: 900 },
  { level: 5, name: "Сенсей", xpRequired: 1500 },
] as const;

export const STREAK_MILESTONES = [
  { days: 7, bonusXp: 50 },
  { days: 14, bonusXp: 100 },
  { days: 30, bonusXp: 200 },
  { days: 60, bonusXp: 500 },
] as const;

export const RATE_LIMITS = {
  auth: { maxRequests: 10, windowMinutes: 1 },
  coach: { maxRequests: 20, windowMinutes: 60 },
  mealRecognition: { maxRequests: 30, windowMinutes: 60 },
  general: { maxRequests: 100, windowMinutes: 1 },
  globalPerIp: { maxRequests: 300, windowMinutes: 1 },
} as const;

export const TOTAL_LESSONS = 14;
export const FREE_LESSON_LIMIT = 3;
export const DUEL_DURATION_DAYS = 7;
export const DUEL_INVITE_EXPIRY_HOURS = 72;
export const MAX_ACTIVE_DUELS = 1;
export const MAX_COACH_MESSAGE_LENGTH = 2000;

export const MEDICAL_KEYWORDS = [
  "дозировка",
  "таблетки",
  "лекарство",
  "оземпик",
  "диагноз",
  "анализы",
  "назначить",
  "прописать",
  "рецепт",
  "давление",
  "инсулин",
] as const;
