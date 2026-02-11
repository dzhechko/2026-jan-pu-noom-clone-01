import {
  MEDICAL_KEYWORDS,
  COACH_SYSTEM_PROMPT,
  COACH_SUGGESTED_QUESTIONS,
  LESSON_TITLES,
} from "@vesna/shared";

/**
 * Checks if a user message contains medical-related keywords.
 * MUST be called BEFORE any Claude API call.
 */
export function containsMedicalRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return MEDICAL_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export interface CoachContext {
  userName: string;
  lastCompletedLessonId: number;
  lessonConcepts: string;
  mealsSummary: string;
  streak: number;
}

/**
 * Builds the system prompt by interpolating user context into the template.
 */
export function buildSystemPrompt(context: CoachContext): string {
  const lessonTitle = LESSON_TITLES[context.lastCompletedLessonId] ?? "Ещё не начал";

  return COACH_SYSTEM_PROMPT
    .replace("{user_name}", context.userName)
    .replace("{current_lesson}", String(context.lastCompletedLessonId))
    .replace("{lesson_concepts}", context.lessonConcepts || lessonTitle)
    .replace("{recent_meals_summary}", context.mealsSummary || "Нет данных")
    .replace("{streak}", String(context.streak));
}

/**
 * Returns suggested questions for the given lesson ID.
 * Falls back to lesson 0 (general) questions if no specific ones exist.
 */
export function getSuggestedQuestions(lastLessonId: number): string[] {
  return COACH_SUGGESTED_QUESTIONS[lastLessonId] ?? COACH_SUGGESTED_QUESTIONS[0];
}
