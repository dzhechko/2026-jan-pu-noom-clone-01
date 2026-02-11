import { describe, it, expect } from "vitest";
import { quizSubmitSchema, quizSaveSchema } from "./quiz";

const validAnswers = {
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

describe("quizSubmitSchema", () => {
  it("accepts valid answers", () => {
    const result = quizSubmitSchema.safeParse(validAnswers);
    expect(result.success).toBe(true);
  });

  it("rejects age below 14", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, age: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects age above 120", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, age: 150 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer age", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, age: 32.5 });
    expect(result.success).toBe(false);
  });

  it("rejects height below 100", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, heightCm: 50 });
    expect(result.success).toBe(false);
  });

  it("rejects weight below 30", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, weightKg: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gender", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, gender: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid activity level", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, activityLevel: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid stress level", () => {
    const result = quizSubmitSchema.safeParse({ ...validAnswers, stressLevel: "medium" });
    expect(result.success).toBe(false);
  });

  it("defaults medicalConditions to empty array", () => {
    const input = { ...validAnswers };
    delete (input as Record<string, unknown>).medicalConditions;
    const result = quizSubmitSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.medicalConditions).toEqual([]);
    }
  });

  it("accepts valid medical conditions", () => {
    const result = quizSubmitSchema.safeParse({
      ...validAnswers,
      medicalConditions: ["diabetes", "hypertension"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid medical condition", () => {
    const result = quizSubmitSchema.safeParse({
      ...validAnswers,
      medicalConditions: ["cancer"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = quizSubmitSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("quizSaveSchema", () => {
  it("accepts valid UUID", () => {
    const result = quizSaveSchema.safeParse({
      quizId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID string", () => {
    const result = quizSaveSchema.safeParse({ quizId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing quizId", () => {
    const result = quizSaveSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
