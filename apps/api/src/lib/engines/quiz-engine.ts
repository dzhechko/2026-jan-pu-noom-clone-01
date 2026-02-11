import type {
  QuizAnswers,
  HealthRisk,
  BmiCategory,
  SubscriptionTier,
  QuizResult,
} from "@vesna/shared";
import {
  BMI_CATEGORIES,
  ACTIVITY_PENALTIES,
  STRESS_PENALTIES,
  GENDER_FACTORS,
} from "@vesna/shared";

export function calculateBMI(
  weightKg: number,
  heightCm: number
): { value: number; category: BmiCategory } {
  const heightM = heightCm / 100;
  const value = Math.round((weightKg / (heightM * heightM)) * 10) / 10;

  const entry = BMI_CATEGORIES.find((c) => value < c.max);
  const category: BmiCategory = entry?.category ?? "obese";

  return { value, category };
}

export function calculateMetabolicAge(
  age: number,
  basePenalty: number,
  genderFactor: number
): number {
  const metabolicAge = age + Math.round(basePenalty * genderFactor);
  const min = age - 5;
  const max = age + 25;
  return Math.max(min, Math.min(max, metabolicAge));
}

function getActivityPenalty(activityLevel: string): number {
  return ACTIVITY_PENALTIES[activityLevel] ?? 0;
}

function getSleepPenalty(sleepHours: number): number {
  if (sleepHours < 5) return 6;
  if (sleepHours < 6) return 4;
  if (sleepHours < 7) return 2;
  if (sleepHours > 9) return 1;
  return 0;
}

function getStressPenalty(stressLevel: string): number {
  return STRESS_PENALTIES[stressLevel] ?? 0;
}

function getBmiPenalty(bmi: number): number {
  if (bmi >= 35) return 7;
  if (bmi >= 30) return 5;
  if (bmi >= 27) return 3;
  if (bmi >= 25) return 1;
  return 0;
}

function getNutritionPenalty(
  mealsPerDay: number,
  snackingFrequency: string,
  waterGlasses: number
): number {
  let penalty = 0;
  if (mealsPerDay < 3) penalty += 2;
  if (snackingFrequency === "often") penalty += 2;
  if (waterGlasses < 4) penalty += 2;
  return penalty;
}

function getMedicalPenalty(medicalConditions: string[]): number {
  const tracked = ["diabetes", "hypertension", "thyroid"];
  return medicalConditions.filter((c) => tracked.includes(c)).length * 3;
}

function interpolateSeverity(
  value: number,
  low: number,
  lowSev: number,
  high: number,
  highSev: number
): number {
  if (value <= low) return lowSev;
  if (value >= high) return highSev;
  const ratio = (value - low) / (high - low);
  return Math.round((lowSev + ratio * (highSev - lowSev)) * 100) / 100;
}

export function generateRisks(
  bmi: number,
  activityLevel: string,
  sleepHours: number,
  stressLevel: string,
  age: number
): HealthRisk[] {
  const pool: HealthRisk[] = [];

  if (bmi >= 25) {
    pool.push({
      type: "metabolic_syndrome",
      title: "Риск метаболического синдрома",
      severity: interpolateSeverity(bmi, 25, 0.3, 35, 0.9),
      description: "Повышенный BMI увеличивает риск диабета 2 типа",
    });
  }

  if (activityLevel === "sedentary") {
    pool.push({
      type: "cardiovascular",
      title: "Сердечно-сосудистые риски",
      severity: age > 40 ? 0.7 : 0.5,
      description: "Малоподвижный образ жизни — фактор риска №1",
    });
  }

  if (sleepHours < 6) {
    const severity =
      sleepHours <= 4 ? 0.8 : interpolateSeverity(sleepHours, 4, 0.8, 6, 0.3);
    pool.push({
      type: "hormonal",
      title: "Гормональный дисбаланс",
      severity,
      description: "Недостаток сна нарушает выработку лептина и грелина",
    });
  }

  if (stressLevel === "high" || stressLevel === "very_high") {
    pool.push({
      type: "cortisol",
      title: "Повышенный кортизол",
      severity: stressLevel === "very_high" ? 0.7 : 0.5,
      description: "Хронический стресс провоцирует набор висцерального жира",
    });
  }

  if (bmi >= 30 && age >= 35) {
    pool.push({
      type: "prediabetes",
      title: "Риск преддиабета",
      severity: 0.7,
      description: "BMI >30 после 35 лет — показание к проверке HbA1c",
    });
  }

  pool.sort((a, b) => b.severity - a.severity);
  return pool.slice(0, 3);
}

export function getRecommendedTier(bmi: number): SubscriptionTier {
  if (bmi < 25) return "free";
  if (bmi < 30) return "premium";
  return "clinical";
}

export function computeQuizResults(
  quizId: string,
  answers: QuizAnswers
): QuizResult {
  const { value: bmi, category: bmiCategory } = calculateBMI(
    answers.weightKg,
    answers.heightCm
  );

  const basePenalty =
    getActivityPenalty(answers.activityLevel) +
    getSleepPenalty(answers.sleepHours) +
    getStressPenalty(answers.stressLevel) +
    getBmiPenalty(bmi) +
    getNutritionPenalty(
      answers.mealsPerDay,
      answers.snackingFrequency,
      answers.waterGlasses
    ) +
    getMedicalPenalty(answers.medicalConditions);

  const genderFactor = GENDER_FACTORS[answers.gender] ?? 1.0;
  const metabolicAge = calculateMetabolicAge(
    answers.age,
    basePenalty,
    genderFactor
  );

  const risks = generateRisks(
    bmi,
    answers.activityLevel,
    answers.sleepHours,
    answers.stressLevel,
    answers.age
  );

  const recommendedTier = getRecommendedTier(bmi);

  return {
    quizId,
    metabolicAge,
    passportAge: answers.age,
    bmi,
    bmiCategory,
    risks,
    recommendedTier,
  };
}
