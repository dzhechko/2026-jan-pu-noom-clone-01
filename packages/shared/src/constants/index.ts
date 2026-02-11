import type { QuizQuestion, BmiCategory } from "../types/index";

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
export const MAX_QUIZ_ATTEMPTS = 3;
export const QUIZ_PASS_THRESHOLD = 2;
export const QUIZ_QUESTIONS_PER_LESSON = 3;

export const LESSON_XP = {
  perfect: 15, // 3/3
  passed: 10, // 2/3
  reviewNeeded: 5, // after 3 failed attempts
} as const;

export const LESSON_TITLES: Record<number, string> = {
  1: "Что такое CBT и как оно работает",
  2: "Автоматические мысли о еде",
  3: "Связь эмоций и переедания",
  4: "Когнитивные искажения при диете",
  5: "Дневник мыслей: практика",
  6: "Осознанное питание",
  7: "Триггеры переедания",
  8: "Работа с чувством вины",
  9: "Стресс и кортизол",
  10: "Социальное давление и еда",
  11: "Формирование новых привычек",
  12: "Мотивация и ценности",
  13: "Предотвращение срывов",
  14: "Долгосрочная стратегия",
} as const;

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

// --- Quiz constants ---

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    type: "radio",
    question: "Ваш пол?",
    options: ["Мужской", "Женский"],
  },
  {
    id: 2,
    type: "number",
    question: "Ваш возраст?",
    min: 14,
    max: 120,
    unit: "лет",
  },
  {
    id: 3,
    type: "number",
    question: "Ваш рост?",
    min: 100,
    max: 250,
    unit: "см",
  },
  {
    id: 4,
    type: "number",
    question: "Ваш вес?",
    min: 30,
    max: 300,
    unit: "кг",
  },
  {
    id: 5,
    type: "select",
    question: "Уровень физической активности?",
    options: ["Сидячий образ жизни", "Лёгкая активность", "Умеренная активность", "Активный образ жизни"],
  },
  {
    id: 6,
    type: "number",
    question: "Сколько часов вы спите?",
    min: 1,
    max: 16,
    unit: "часов",
  },
  {
    id: 7,
    type: "select",
    question: "Уровень стресса?",
    options: ["Низкий", "Умеренный", "Высокий", "Очень высокий"],
  },
  {
    id: 8,
    type: "select",
    question: "Сколько раз в день вы едите?",
    options: ["1-2 раза", "3 раза", "4 и более"],
  },
  {
    id: 9,
    type: "select",
    question: "Как часто вы перекусываете?",
    options: ["Никогда", "Редко", "Часто"],
  },
  {
    id: 10,
    type: "number",
    question: "Сколько стаканов воды вы пьёте в день?",
    min: 0,
    max: 20,
    unit: "стаканов",
  },
  {
    id: 11,
    type: "multiselect",
    question: "Есть ли у вас хронические заболевания?",
    options: ["Диабет", "Гипертония", "Щитовидная железа", "Нет"],
  },
  {
    id: 12,
    type: "multiselect",
    question: "Принимаете ли вы лекарства?",
    options: ["Инсулин", "Метформин", "Статины", "Другие", "Нет"],
  },
];

export const BMI_CATEGORIES: { max: number; category: BmiCategory }[] = [
  { max: 18.5, category: "underweight" },
  { max: 25, category: "normal" },
  { max: 30, category: "overweight" },
  { max: Infinity, category: "obese" },
];

export const ACTIVITY_PENALTIES: Record<string, number> = {
  sedentary: 8,
  light: 4,
  moderate: 1,
  active: 0,
};

export const STRESS_PENALTIES: Record<string, number> = {
  very_high: 5,
  high: 3,
  moderate: 1,
  low: 0,
};

export const GENDER_FACTORS: Record<string, number> = {
  female: 0.9,
  male: 1.0,
};

export const QUIZ_RESULT_TTL_SECONDS = 24 * 60 * 60; // 24 hours
