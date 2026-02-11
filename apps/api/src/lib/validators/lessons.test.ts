import { describe, it, expect } from "vitest";
import { lessonIdParamSchema, lessonCompleteSchema } from "./lessons";

describe("lessonIdParamSchema", () => {
  it("accepts valid lesson ID as string", () => {
    const result = lessonIdParamSchema.safeParse({ id: "1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(1);
  });

  it("accepts valid lesson ID as number", () => {
    const result = lessonIdParamSchema.safeParse({ id: 14 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(14);
  });

  it("rejects lesson ID 0", () => {
    expect(lessonIdParamSchema.safeParse({ id: "0" }).success).toBe(false);
  });

  it("rejects lesson ID 15", () => {
    expect(lessonIdParamSchema.safeParse({ id: "15" }).success).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(lessonIdParamSchema.safeParse({ id: "1.5" }).success).toBe(false);
  });

  it("rejects negative", () => {
    expect(lessonIdParamSchema.safeParse({ id: "-1" }).success).toBe(false);
  });

  it("rejects non-numeric string", () => {
    expect(lessonIdParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("lessonCompleteSchema", () => {
  it("accepts valid quiz answers [0, 1, 2]", () => {
    const result = lessonCompleteSchema.safeParse({ quizAnswers: [0, 1, 2] });
    expect(result.success).toBe(true);
  });

  it("accepts all zeros", () => {
    const result = lessonCompleteSchema.safeParse({ quizAnswers: [0, 0, 0] });
    expect(result.success).toBe(true);
  });

  it("accepts max index (3)", () => {
    const result = lessonCompleteSchema.safeParse({ quizAnswers: [3, 3, 3] });
    expect(result.success).toBe(true);
  });

  it("rejects wrong array length (2 answers)", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [0, 1] }).success).toBe(false);
  });

  it("rejects wrong array length (4 answers)", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [0, 1, 2, 3] }).success).toBe(false);
  });

  it("rejects negative index", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [-1, 0, 0] }).success).toBe(false);
  });

  it("rejects index > 3", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [4, 0, 0] }).success).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [0.5, 1, 2] }).success).toBe(false);
  });

  it("rejects missing quizAnswers", () => {
    expect(lessonCompleteSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty array", () => {
    expect(lessonCompleteSchema.safeParse({ quizAnswers: [] }).success).toBe(false);
  });
});
