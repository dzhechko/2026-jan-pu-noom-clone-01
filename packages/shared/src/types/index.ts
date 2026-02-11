export type SubscriptionTier = "free" | "premium" | "clinical";

export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type RecognitionMethod = "ai_photo" | "manual_search" | "manual_entry";

export type LessonStatus = "locked" | "available" | "completed" | "review_needed";

export type DuelStatus = "pending" | "active" | "completed" | "expired";

export interface QuizAnswers {
  gender: Gender;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  sleepHours: number;
  stressLevel: "low" | "medium" | "high";
  smokingStatus: boolean;
  alcoholFrequency: "never" | "rarely" | "weekly" | "daily";
  dietType: "balanced" | "high_carb" | "high_fat" | "irregular";
  waterIntake: "low" | "normal" | "high";
  familyHistory: string[];
}

export interface HealthRisk {
  id: string;
  name: string;
  severity: "low" | "medium" | "high";
  description: string;
}
