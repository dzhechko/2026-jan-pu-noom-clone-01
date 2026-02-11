export type ErrorCode =
  | "AUTH_001"
  | "AUTH_002"
  | "AUTH_003"
  | "AUTH_004"
  | "QUIZ_001"
  | "QUIZ_002"
  | "LESSON_001"
  | "LESSON_002"
  | "LESSON_003"
  | "MEAL_001"
  | "MEAL_002"
  | "MEAL_003"
  | "COACH_001"
  | "COACH_002"
  | "DUEL_001"
  | "DUEL_002"
  | "DUEL_003"
  | "PAY_001"
  | "PAY_002"
  | "GEN_001"
  | "GEN_002";

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

const ERROR_MESSAGES: Record<ErrorCode, { status: number; message: string }> = {
  AUTH_001: { status: 401, message: "Неверный email или пароль" },
  AUTH_002: { status: 423, message: "Аккаунт временно заблокирован. Попробуйте через 15 минут" },
  AUTH_003: { status: 429, message: "Слишком много попыток. Подождите немного" },
  AUTH_004: { status: 409, message: "Этот email уже зарегистрирован. Войти?" },
  QUIZ_001: { status: 400, message: "Проверьте правильность данных" },
  QUIZ_002: { status: 404, message: "Сессия истекла. Начните quiz заново" },
  LESSON_001: { status: 403, message: "Доступно в Premium" },
  LESSON_002: { status: 409, message: "Урок уже пройден" },
  LESSON_003: { status: 400, message: "Сначала пройдите предыдущий урок" },
  MEAL_001: { status: 400, message: "Файл слишком большой. Максимум 5 МБ" },
  MEAL_002: { status: 422, message: "Не удалось распознать. Попробуйте другое фото или найдите вручную" },
  MEAL_003: { status: 503, message: "Сервис распознавания временно недоступен. Введите вручную" },
  COACH_001: { status: 503, message: "AI-коуч сейчас недоступен. Попробуйте через минуту" },
  COACH_002: { status: 429, message: "Вы задали много вопросов. Передохните и вернитесь через час" },
  DUEL_001: { status: 403, message: "Дуэли доступны в Premium" },
  DUEL_002: { status: 410, message: "Ссылка истекла. Попросите друга отправить новую" },
  DUEL_003: { status: 409, message: "У вас уже есть активная дуэль" },
  PAY_001: { status: 402, message: "Оплата не прошла. Проверьте данные карты" },
  PAY_002: { status: 502, message: "Сервис оплаты временно недоступен" },
  GEN_001: { status: 500, message: "Что-то пошло не так. Мы уже разбираемся" },
  GEN_002: { status: 503, message: "Проводим технические работы. Скоро вернёмся" },
};

export function apiError(
  code: ErrorCode,
  details?: Record<string, unknown>
): { body: { error: ApiError }; status: number } {
  const { status, message } = ERROR_MESSAGES[code];
  return {
    body: { error: { code, message, ...(details && { details }) } },
    status,
  };
}
