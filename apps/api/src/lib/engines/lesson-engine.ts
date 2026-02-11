import type { LessonProgress } from "@prisma/client";
import type {
  SubscriptionTier,
  LessonListItem,
  LessonListStatus,
  LessonStatus,
  LessonQuizQuestionWithAnswer,
  LessonContentFull,
  LessonContent,
} from "@vesna/shared";
import {
  TOTAL_LESSONS,
  FREE_LESSON_LIMIT,
  MAX_QUIZ_ATTEMPTS,
  QUIZ_PASS_THRESHOLD,
  LESSON_XP,
  LESSON_TITLES,
} from "@vesna/shared";

export interface GradeResult {
  score: number;
  passed: boolean;
  xpEarned: number;
  status: LessonStatus;
  shouldSave: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
}

/**
 * Compute the full lesson list with statuses including paywall.
 * "review_needed" counts as done for unlocking the next lesson.
 */
export function computeLessonList(
  progressRecords: Pick<LessonProgress, "lessonId" | "status" | "quizScore" | "xpEarned">[],
  tier: SubscriptionTier
): LessonListItem[] {
  const progressMap = new Map(
    progressRecords.map((p) => [p.lessonId, p])
  );

  // Find the highest completed/review_needed lesson
  const doneStatuses: LessonStatus[] = ["completed", "review_needed"];
  let highestDone = 0;
  for (const p of progressRecords) {
    if (doneStatuses.includes(p.status as LessonStatus) && p.lessonId > highestDone) {
      highestDone = p.lessonId;
    }
  }

  const nextAvailable = highestDone + 1;
  const lessons: LessonListItem[] = [];

  for (let id = 1; id <= TOTAL_LESSONS; id++) {
    const progress = progressMap.get(id);
    let status: LessonListStatus;

    if (progress && doneStatuses.includes(progress.status as LessonStatus)) {
      status = progress.status as LessonStatus;
    } else if (id === nextAvailable) {
      if (tier === "free" && id > FREE_LESSON_LIMIT) {
        status = "paywall";
      } else {
        status = "available";
      }
    } else {
      status = "locked";
    }

    lessons.push({
      id,
      title: LESSON_TITLES[id] ?? `Урок ${id}`,
      status,
      quizScore: progress?.quizScore ?? null,
      xpEarned: progress?.xpEarned ?? 0,
    });
  }

  return lessons;
}

export type AccessCheckResult =
  | { allowed: true }
  | { allowed: false; errorCode: "LESSON_001" | "LESSON_003" };

/**
 * Check if a user can access a specific lesson.
 */
export function checkLessonAccess(
  lessonId: number,
  tier: SubscriptionTier,
  progressRecords: Pick<LessonProgress, "lessonId" | "status">[]
): AccessCheckResult {
  const doneStatuses: LessonStatus[] = ["completed", "review_needed"];

  let highestDone = 0;
  for (const p of progressRecords) {
    if (doneStatuses.includes(p.status as LessonStatus) && p.lessonId > highestDone) {
      highestDone = p.lessonId;
    }
  }

  const nextAvailable = highestDone + 1;

  // Can access completed/review_needed lessons and the next available one
  if (lessonId > nextAvailable) {
    return { allowed: false, errorCode: "LESSON_003" };
  }

  // Paywall check for free users
  if (tier === "free" && lessonId > FREE_LESSON_LIMIT) {
    return { allowed: false, errorCode: "LESSON_001" };
  }

  return { allowed: true };
}

/**
 * Grade a quiz submission.
 */
export function gradeQuiz(
  userAnswers: number[],
  correctAnswers: number[],
  currentAttempts: number,
  alreadyCompleted: boolean
): GradeResult {
  if (alreadyCompleted) {
    // Should not happen — caller checks first
    return {
      score: 0,
      passed: false,
      xpEarned: 0,
      status: "completed",
      shouldSave: false,
      attemptsUsed: currentAttempts,
      attemptsRemaining: 0,
    };
  }

  const score = userAnswers.reduce(
    (count, answer, i) => count + (answer === correctAnswers[i] ? 1 : 0),
    0
  );

  const newAttempts = currentAttempts + 1;
  const passed = score >= QUIZ_PASS_THRESHOLD;

  if (passed) {
    const xpEarned = score === correctAnswers.length ? LESSON_XP.perfect : LESSON_XP.passed;
    return {
      score,
      passed: true,
      xpEarned,
      status: "completed",
      shouldSave: true,
      attemptsUsed: newAttempts,
      attemptsRemaining: MAX_QUIZ_ATTEMPTS - newAttempts,
    };
  }

  // Failed
  if (newAttempts >= MAX_QUIZ_ATTEMPTS) {
    // Max attempts reached — review_needed with partial XP
    return {
      score,
      passed: false,
      xpEarned: LESSON_XP.reviewNeeded,
      status: "review_needed",
      shouldSave: true,
      attemptsUsed: newAttempts,
      attemptsRemaining: 0,
    };
  }

  // Failed but has retries remaining — save attempt count only, no status change
  return {
    score,
    passed: false,
    xpEarned: 0,
    status: "available",
    shouldSave: false,
    attemptsUsed: newAttempts,
    attemptsRemaining: MAX_QUIZ_ATTEMPTS - newAttempts,
  };
}

/**
 * Strip correctAnswer fields from lesson content before sending to client.
 */
export function stripQuizAnswers(content: LessonContentFull): LessonContent {
  return {
    ...content,
    sections: {
      ...content.sections,
      quiz: {
        questions: content.sections.quiz.questions.map(
          ({ correctAnswer, ...q }) => q
        ),
      },
    },
  };
}
