export type SubscriptionTier = "free" | "premium" | "clinical";

export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type StressLevel = "low" | "moderate" | "high" | "very_high";

export type SnackingFrequency = "never" | "rarely" | "often";

export type BmiCategory = "underweight" | "normal" | "overweight" | "obese";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type RecognitionMethod = "ai_photo" | "manual_search" | "manual_entry";

export type LessonStatus = "locked" | "available" | "completed" | "review_needed";

export type DuelStatus = "pending" | "active" | "completed" | "expired";

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
