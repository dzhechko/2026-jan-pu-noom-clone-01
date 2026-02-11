import { describe, it, expect } from "vitest";
import {
  calculateBMI,
  calculateMetabolicAge,
  generateRisks,
  getRecommendedTier,
  computeQuizResults,
} from "./quiz-engine";
import type { QuizAnswers } from "@vesna/shared";

describe("calculateBMI", () => {
  it("computes BMI and category correctly for overweight", () => {
    const { value, category } = calculateBMI(78, 165);
    expect(value).toBe(28.7);
    expect(category).toBe("overweight");
  });

  it("returns normal for healthy weight", () => {
    const { value, category } = calculateBMI(65, 175);
    expect(value).toBe(21.2);
    expect(category).toBe("normal");
  });

  it("returns underweight for low BMI", () => {
    const { value, category } = calculateBMI(45, 170);
    expect(value).toBe(15.6);
    expect(category).toBe("underweight");
  });

  it("returns obese for high BMI", () => {
    const { value, category } = calculateBMI(120, 170);
    expect(value).toBe(41.5);
    expect(category).toBe("obese");
  });
});

describe("calculateMetabolicAge", () => {
  it("adds rounded penalty with gender factor", () => {
    // age=32, penalty=22, genderFactor=0.9 → 32 + round(19.8) = 52
    const result = calculateMetabolicAge(32, 22, 0.9);
    expect(result).toBe(52);
  });

  it("clamps to max (age + 25)", () => {
    const result = calculateMetabolicAge(30, 50, 1.0);
    // 30 + 50 = 80, but max is 30+25 = 55
    expect(result).toBe(55);
  });

  it("clamps to min (age - 5)", () => {
    const result = calculateMetabolicAge(30, -10, 1.0);
    // 30 + (-10) = 20, but min is 30-5 = 25
    expect(result).toBe(25);
  });

  it("returns exact value when within range", () => {
    const result = calculateMetabolicAge(40, 10, 1.0);
    expect(result).toBe(50);
  });
});

describe("generateRisks", () => {
  it("returns up to 3 risks sorted by severity", () => {
    const risks = generateRisks(32, "sedentary", 4, "very_high", 45);
    expect(risks.length).toBe(3);
    expect(risks[0].severity).toBeGreaterThanOrEqual(risks[1].severity);
    expect(risks[1].severity).toBeGreaterThanOrEqual(risks[2].severity);
  });

  it("includes metabolic_syndrome for BMI >= 25", () => {
    const risks = generateRisks(28, "active", 8, "low", 30);
    expect(risks.some((r) => r.type === "metabolic_syndrome")).toBe(true);
  });

  it("includes cardiovascular for sedentary", () => {
    const risks = generateRisks(22, "sedentary", 8, "low", 30);
    expect(risks.some((r) => r.type === "cardiovascular")).toBe(true);
  });

  it("has higher cardiovascular severity for age > 40", () => {
    const risksYoung = generateRisks(22, "sedentary", 8, "low", 30);
    const risksOlder = generateRisks(22, "sedentary", 8, "low", 50);
    const youngSev = risksYoung.find((r) => r.type === "cardiovascular")!.severity;
    const olderSev = risksOlder.find((r) => r.type === "cardiovascular")!.severity;
    expect(olderSev).toBeGreaterThan(youngSev);
  });

  it("returns empty array when no risk criteria met", () => {
    const risks = generateRisks(22, "active", 8, "low", 25);
    expect(risks).toEqual([]);
  });

  it("includes prediabetes for BMI >= 30 and age >= 35", () => {
    const risks = generateRisks(31, "active", 8, "low", 40);
    expect(risks.some((r) => r.type === "prediabetes")).toBe(true);
  });
});

describe("getRecommendedTier", () => {
  it("returns free for BMI < 25", () => {
    expect(getRecommendedTier(22)).toBe("free");
  });

  it("returns premium for BMI 25-29.9", () => {
    expect(getRecommendedTier(27)).toBe("premium");
  });

  it("returns clinical for BMI >= 30", () => {
    expect(getRecommendedTier(35)).toBe("clinical");
  });
});

describe("computeQuizResults", () => {
  it("computes full results matching pseudocode example", () => {
    const answers: QuizAnswers = {
      gender: "female",
      age: 32,
      heightCm: 165,
      weightKg: 78,
      activityLevel: "sedentary",
      sleepHours: 6,
      stressLevel: "high",
      mealsPerDay: 2,
      snackingFrequency: "often",
      waterGlasses: 4,
      medicalConditions: [],
      medications: [],
    };

    const result = computeQuizResults("test-id", answers);

    expect(result.quizId).toBe("test-id");
    expect(result.passportAge).toBe(32);
    expect(result.bmiCategory).toBe("overweight");
    expect(result.risks.length).toBeGreaterThan(0);
    expect(result.risks.length).toBeLessThanOrEqual(3);
    expect(result.recommendedTier).toBe("premium");
    // BMI ≈ 28.7
    expect(result.bmi).toBeCloseTo(28.7, 0);
    // Penalties: activity(8)+sleep(2)+stress(3)+bmi(3)+nutrition(2+2+0)+medical(0) = 20
    // metabolicAge = 32 + round(20 * 0.9) = 32 + 18 = 50
    expect(result.metabolicAge).toBe(50);
  });

  it("handles healthy individual with minimal penalties", () => {
    const answers: QuizAnswers = {
      gender: "male",
      age: 25,
      heightCm: 180,
      weightKg: 70,
      activityLevel: "active",
      sleepHours: 8,
      stressLevel: "low",
      mealsPerDay: 3,
      snackingFrequency: "never",
      waterGlasses: 8,
      medicalConditions: [],
      medications: [],
    };

    const result = computeQuizResults("test-healthy", answers);

    expect(result.bmiCategory).toBe("normal");
    expect(result.metabolicAge).toBe(25); // 0 penalties
    expect(result.recommendedTier).toBe("free");
    expect(result.risks).toEqual([]);
  });

  it("handles maximum penalties with medical conditions", () => {
    const answers: QuizAnswers = {
      gender: "male",
      age: 50,
      heightCm: 170,
      weightKg: 110,
      activityLevel: "sedentary",
      sleepHours: 4,
      stressLevel: "very_high",
      mealsPerDay: 1,
      snackingFrequency: "often",
      waterGlasses: 1,
      medicalConditions: ["diabetes", "hypertension", "thyroid"],
      medications: ["insulin", "metformin"],
    };

    const result = computeQuizResults("test-high-risk", answers);

    expect(result.bmiCategory).toBe("obese");
    expect(result.recommendedTier).toBe("clinical");
    // Penalties: activity(8)+sleep(6)+stress(5)+bmi(7)+nutrition(2+2+2)+medical(9) = 41
    // metabolicAge = 50 + 41 = 91, clamped to 50+25 = 75
    expect(result.metabolicAge).toBe(75);
    expect(result.risks.length).toBe(3);
  });
});
