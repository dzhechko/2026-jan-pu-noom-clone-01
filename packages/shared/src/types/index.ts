export type SubscriptionTier = "free" | "premium" | "clinical";

export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type StressLevel = "low" | "moderate" | "high" | "very_high";

export type SnackingFrequency = "never" | "rarely" | "often";

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type RecognitionMethod = "ai_photo" | "manual_search" | "manual_entry";

export type LessonStatus = "locked" | "available" | "completed" | "review_needed";

export type LessonListStatus = LessonStatus | "paywall";

export interface LessonListItem {
  id: number;
  title: string;
  status: LessonListStatus;
  quizScore: number | null;
  xpEarned: number;
}

export interface LessonQuizQuestion {
  id: number;
  question: string;
  options: string[];
}

export interface LessonQuizQuestionWithAnswer extends LessonQuizQuestion {
  correctAnswer: number;
}

export interface LessonContent {
  id: number;
  title: string;
  description: string;
  sections: {
    theory: string;
    example: string;
    quiz: { questions: LessonQuizQuestion[] };
    assignment: string;
  };
}

export interface LessonContentFull {
  id: number;
  title: string;
  description: string;
  sections: {
    theory: string;
    example: string;
    quiz: { questions: LessonQuizQuestionWithAnswer[] };
    assignment: string;
  };
}

export interface LessonCompletionResult {
  score: number;
  passed: boolean;
  xpEarned: number;
  status: LessonStatus;
  attemptsUsed: number;
  attemptsRemaining: number;
  streak: {
    current: number;
    longest: number;
    bonusXp: number;
  } | null;
  nextLessonId: number | null;
}

export interface CoachResponse {
  response: string;
  suggestedQuestions: string[];
}

export type DuelStatus = "pending" | "active" | "completed" | "expired";

export type DuelAction = "lesson_completed" | "meal_logged" | "streak_maintained";

export interface DuelScoreBreakdown {
  lessonPoints: number;
  mealPoints: number;
  streakPoints: number;
}

export interface DuelParticipant {
  userId: string;
  name: string;
  score: number;
}

export interface DuelScoreboard {
  duelId: string;
  status: DuelStatus;
  challenger: DuelParticipant;
  opponent: DuelParticipant;
  startDate: string;
  endDate: string;
  winnerId: string | null;
  remainingMs: number;
}

export interface DuelListItem {
  id: string;
  status: DuelStatus;
  challengerName: string;
  opponentName: string | null;
  challengerScore: number;
  opponentScore: number;
  winnerId: string | null;
  createdAt: string;
  endDate: string | null;
}

export interface DuelCreateResult {
  duelId: string;
  inviteToken: string;
  inviteLink: string;
  expiresAt: string;
}

export type MedicalCondition = "diabetes" | "hypertension" | "thyroid";

export type QuizQuestionType = "radio" | "number" | "select" | "multiselect";

export interface QuizQuestion {
  id: number;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  min?: number;
  max?: number;
  unit?: string;
}

export interface QuizAnswers {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  sleepHours: number;
  stressLevel: StressLevel;
  mealsPerDay: number;
  snackingFrequency: SnackingFrequency;
  waterGlasses: number;
  medicalConditions: MedicalCondition[];
  medications: string[];
}

export interface HealthRisk {
  type: string;
  title: string;
  severity: number;
  description: string;
}

export interface QuizResult {
  quizId: string;
  metabolicAge: number;
  passportAge: number;
  bmi: number;
  bmiCategory: BmiCategory;
  risks: HealthRisk[];
  recommendedTier: SubscriptionTier;
}
