import type { QuizQuestion, BmiCategory } from "../types/index";
import type { NotificationType, NotificationPrefs, NotificationMessage } from "../types/index";

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

export const DUEL_SCORE_POINTS: Record<string, number> = {
  lesson_completed: 10,
  meal_logged: 5,
  streak_maintained: 5,
};

export const DUEL_XP_REWARDS = {
  winner: 100,
  participation: 30,
} as const;

export const DUEL_WINNER_BADGE = "Чемпион Дуэли";
export const MAX_COACH_MESSAGE_LENGTH = 2000;

export const MEAL_XP = 3;
export const DAILY_GOAL_XP = 15;

export const BADGE_DEFINITIONS = [
  { id: "streak_7", name: "7 дней подряд", icon: "fire", description: "Серия 7 дней" },
  { id: "streak_14", name: "2 недели подряд", icon: "fire", description: "Серия 14 дней" },
  { id: "streak_30", name: "Месяц подряд", icon: "fire", description: "Серия 30 дней" },
  { id: "streak_60", name: "2 месяца подряд", icon: "fire", description: "Серия 60 дней" },
  { id: "lessons_all", name: "Все уроки пройдены", icon: "book", description: "14 из 14 уроков" },
  { id: "meals_100", name: "100 приёмов пищи", icon: "utensils", description: "Записано 100 приёмов" },
  { id: "duel_champion", name: "Чемпион Дуэли", icon: "trophy", description: "Победа в дуэли" },
] as const;

// --- Notifications constants ---

function escapeHtml(text: string | number): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  lessonReminder: true,
  streakRisk: true,
  churnPrevention: true,
  duelEvents: true,
  weeklyReport: true,
};

export const DEFAULT_TIMEZONE = "Europe/Moscow";
export const NOTIFICATION_DAILY_CAP = 3;
export const NOTIFICATION_QUIET_START = 22; // 22:00
export const NOTIFICATION_QUIET_END = 8;   // 08:00
export const NOTIFICATION_RATE_DELAY_MS = 35; // 35ms between sends (≈28/sec)

export const NOTIFICATION_PREF_MAP: Record<NotificationType, keyof NotificationPrefs> = {
  lesson_reminder: "lessonReminder",
  streak_risk: "streakRisk",
  churn_2d: "churnPrevention",
  churn_5d: "churnPrevention",
  churn_14d: "churnPrevention",
  duel_accepted: "duelEvents",
  duel_completed: "duelEvents",
  weekly_report: "weeklyReport",
};

export const NOTIFICATION_TEMPLATES: Record<
  NotificationType,
  (data: Record<string, string | number>) => NotificationMessage
> = {
  lesson_reminder: () => ({
    text: "📚 <b>Урок ждёт!</b>\n3 минуты для новых привычек",
    buttonText: "Открыть урок",
    buttonUrl: "/lessons",
  }),
  streak_risk: (data) => ({
    text: `🔥 <b>Streak на кону!</b>\nВаша серия ${escapeHtml(data.streak)} дней. Не потеряйте!`,
    buttonText: "Продолжить серию",
    buttonUrl: "/lessons",
  }),
  churn_2d: () => ({
    text: "👋 <b>Мы скучаем!</b>\nВаш AI-коуч подготовил новый совет",
    buttonText: "Поговорить с коучем",
    buttonUrl: "/coach",
  }),
  churn_5d: () => ({
    text: "💪 <b>Ваш прогресс сохранён!</b>\nВернитесь и продолжите путь к цели",
    buttonText: "Вернуться",
    buttonUrl: "/",
  }),
  churn_14d: () => ({
    text: "🌟 <b>Не сдавайтесь!</b>\nВаш план ждёт вас",
    buttonText: "Вернуться",
    buttonUrl: "/",
  }),
  duel_accepted: (data) => ({
    text: `⚔️ <b>Дуэль началась!</b>\n${escapeHtml(data.opponentName)} принял ваш вызов`,
    buttonText: "К дуэли",
    buttonUrl: `/duels/${data.duelId}`,
  }),
  duel_completed: (data) => ({
    text: "🏆 <b>Дуэль завершена!</b>\nСмотри результаты",
    buttonText: "Результаты",
    buttonUrl: `/duels/${data.duelId}`,
  }),
  weekly_report: (data) => ({
    text: `📊 <b>Итоги недели</b>\nУроков: ${escapeHtml(data.lessons)} | Приёмов пищи: ${escapeHtml(data.meals)} | Серия: ${escapeHtml(data.streak)}`,
    buttonText: "Подробнее",
    buttonUrl: "/",
  }),
};

// --- Subscription constants ---

export const TRIAL_DURATION_DAYS = 7;
export const SUBSCRIPTION_DURATION_DAYS = 30;
export const SUBSCRIPTION_PRICE_STARS = 250;
export const SUBSCRIPTION_CURRENCY = "XTR";
export const SUBSCRIPTION_PRICE_RUB_APPROX = 499;
export const INVOICE_DEDUP_TTL_SECONDS = 300; // 5 min
export const TRIAL_EXPIRY_WARNING_HOURS = 24;

export const SUBSCRIPTION_FEATURES_LOST = [
  { name: "AI-коуч", description: "Персональные CBT-рекомендации" },
  { name: "Уроки 4-14", description: "11 продвинутых CBT-уроков" },
  { name: "Дуэли", description: "Соревнования с друзьями" },
] as const;

export const MEDICAL_KEYWORDS = [
  "дозировка",
  "таблетки",
  "лекарство",
  "оземпик",
  "семаглутид",
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

// --- Coach constants ---

export const COACH_SYSTEM_PROMPT = `Ты — AI-коуч программы «Весна» по когнитивно-поведенческой терапии (CBT) для управления весом.

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Имя: {user_name}
- Текущий урок: {current_lesson} из 14
- Ключевые концепции пройденных уроков: {lesson_concepts}
- Питание за 3 дня: {recent_meals_summary}
- Streak: {streak} дней

ПРАВИЛА:
1. Отвечай на русском, дружелюбно и поддерживающе
2. Используй CBT-техники из пройденных уроков
3. Никогда не давай медицинских рекомендаций (лекарства, дозировки, диагнозы)
4. Длина ответа: 50-200 слов
5. Включай 1-2 конкретных действия, которые можно сделать сегодня
6. Не осуждай за срывы — помогай проанализировать триггеры
7. Если спрашивают о медицине — перенаправь к врачу`;

export const MEDICAL_DISCLAIMER =
  "Я не могу давать медицинские рекомендации — это вопрос для вашего лечащего врача. " +
  "Но я могу помочь с когнитивно-поведенческими техниками для управления весом. " +
  "Давайте поговорим о ваших привычках и мыслях о еде?";

export const COACH_SUGGESTED_QUESTIONS: Record<number, string[]> = {
  0: [
    "Как начать менять пищевые привычки?",
    "Что такое когнитивно-поведенческая терапия?",
    "Как справиться с перееданием?",
  ],
  1: [
    "Как CBT помогает с весом?",
    "Какие автоматические мысли мешают похудению?",
    "С чего начать вести дневник мыслей?",
  ],
  2: [
    "Как отслеживать автоматические мысли о еде?",
    "Почему я ем, когда не голоден?",
    "Как заменить негативные мысли о еде?",
  ],
  3: [
    "Как эмоции влияют на мой аппетит?",
    "Что делать, когда хочется есть от стресса?",
    "Как различить физический и эмоциональный голод?",
  ],
  4: [
    "Какие когнитивные искажения связаны с диетой?",
    "Как перестать мыслить в стиле «всё или ничего»?",
    "Почему я виню себя после еды?",
  ],
  5: [
    "Как правильно вести дневник мыслей?",
    "Что записывать в дневник после еды?",
    "Как анализировать свои записи?",
  ],
  6: [
    "Что такое осознанное питание?",
    "Как есть медленнее и наслаждаться едой?",
    "Как практиковать осознанность за столом?",
  ],
  7: [
    "Какие у меня триггеры переедания?",
    "Как справиться с триггером, не переедая?",
    "Как создать план для сложных ситуаций?",
  ],
  8: [
    "Как перестать чувствовать вину после еды?",
    "Почему самокритика мешает похудению?",
    "Как быть добрее к себе?",
  ],
  9: [
    "Как стресс влияет на мой вес?",
    "Какие техники помогут снизить кортизол?",
    "Как расслабиться без еды?",
  ],
  10: [
    "Как отвечать на комментарии о моём весе?",
    "Как не переедать на праздниках?",
    "Как справиться с давлением окружающих?",
  ],
  11: [
    "Сколько времени нужно для формирования привычки?",
    "Как не сорваться с новой привычки?",
    "Какие маленькие шаги я могу сделать сегодня?",
  ],
  12: [
    "Как поддерживать мотивацию долгосрочно?",
    "Что делать, когда мотивация падает?",
    "Как связать похудение с моими ценностями?",
  ],
  13: [
    "Как предотвратить срыв?",
    "Что делать, если я сорвался?",
    "Как вернуться в колею после срыва?",
  ],
  14: [
    "Как поддерживать результат долгосрочно?",
    "Какие привычки помогут не набрать вес обратно?",
    "Как составить план на следующий месяц?",
  ],
};
