import { describe, it, expect } from "vitest";
import {
  containsMedicalRequest,
  buildSystemPrompt,
  getSuggestedQuestions,
} from "./coach-engine";
import type { CoachContext } from "./coach-engine";

describe("containsMedicalRequest", () => {
  it("detects 'дозировка'", () => {
    expect(containsMedicalRequest("Какая дозировка?")).toBe(true);
  });

  it("detects 'таблетки'", () => {
    expect(containsMedicalRequest("Мне нужны таблетки")).toBe(true);
  });

  it("detects 'лекарство'", () => {
    expect(containsMedicalRequest("Какое лекарство принять?")).toBe(true);
  });

  it("detects 'оземпик'", () => {
    expect(containsMedicalRequest("Что думаешь про оземпик?")).toBe(true);
  });

  it("detects 'семаглутид'", () => {
    expect(containsMedicalRequest("Расскажи про семаглутид")).toBe(true);
  });

  it("detects 'диагноз'", () => {
    expect(containsMedicalRequest("Поставь мне диагноз")).toBe(true);
  });

  it("detects 'анализы'", () => {
    expect(containsMedicalRequest("Какие анализы сдать?")).toBe(true);
  });

  it("detects 'назначить'", () => {
    expect(containsMedicalRequest("Можешь назначить лечение?")).toBe(true);
  });

  it("detects 'прописать'", () => {
    expect(containsMedicalRequest("Прописать мне диету")).toBe(true);
  });

  it("detects 'рецепт'", () => {
    expect(containsMedicalRequest("Дай рецепт лекарства")).toBe(true);
  });

  it("detects 'давление'", () => {
    expect(containsMedicalRequest("У меня высокое давление")).toBe(true);
  });

  it("detects 'инсулин'", () => {
    expect(containsMedicalRequest("Нужен инсулин")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsMedicalRequest("ОЗЕМПИК помогает?")).toBe(true);
    expect(containsMedicalRequest("Таблетки от давления")).toBe(true);
  });

  it("returns false for clean CBT messages", () => {
    expect(containsMedicalRequest("Привет! Как начать?")).toBe(false);
    expect(containsMedicalRequest("Как справиться со стрессом?")).toBe(false);
    expect(containsMedicalRequest("Расскажи про осознанное питание")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(containsMedicalRequest("")).toBe(false);
  });
});

describe("buildSystemPrompt", () => {
  const baseContext: CoachContext = {
    userName: "Мария",
    lastCompletedLessonId: 3,
    lessonConcepts: "Связь эмоций и переедания",
    mealsSummary: "Овсянка (300 ккал), Салат (200 ккал)",
    streak: 7,
  };

  it("interpolates all placeholders", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).toContain("Мария");
    expect(prompt).toContain("3");
    expect(prompt).toContain("Связь эмоций и переедания");
    expect(prompt).toContain("Овсянка (300 ккал), Салат (200 ккал)");
    expect(prompt).toContain("7 дней");
  });

  it("does not contain unresolved placeholders", () => {
    const prompt = buildSystemPrompt(baseContext);
    expect(prompt).not.toContain("{user_name}");
    expect(prompt).not.toContain("{current_lesson}");
    expect(prompt).not.toContain("{lesson_concepts}");
    expect(prompt).not.toContain("{recent_meals_summary}");
    expect(prompt).not.toContain("{streak}");
  });

  it("uses lesson title as fallback when lessonConcepts is empty", () => {
    const prompt = buildSystemPrompt({ ...baseContext, lessonConcepts: "" });
    expect(prompt).toContain("Связь эмоций и переедания"); // from LESSON_TITLES[3]
  });

  it("uses 'Нет данных' for empty meals summary", () => {
    const prompt = buildSystemPrompt({ ...baseContext, mealsSummary: "" });
    expect(prompt).toContain("Нет данных");
  });

  it("handles lesson 0 (no lessons completed)", () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      lastCompletedLessonId: 0,
      lessonConcepts: "",
    });
    expect(prompt).toContain("0 из 14");
  });
});

describe("getSuggestedQuestions", () => {
  it("returns questions for lesson 1", () => {
    const questions = getSuggestedQuestions(1);
    expect(questions).toHaveLength(3);
    expect(questions[0]).toContain("CBT");
  });

  it("returns questions for lesson 14", () => {
    const questions = getSuggestedQuestions(14);
    expect(questions).toHaveLength(3);
  });

  it("returns fallback (lesson 0) questions for unknown lesson", () => {
    const questions = getSuggestedQuestions(99);
    const fallback = getSuggestedQuestions(0);
    expect(questions).toEqual(fallback);
  });

  it("returns 3 questions for each defined lesson", () => {
    for (let i = 0; i <= 14; i++) {
      const questions = getSuggestedQuestions(i);
      expect(questions).toHaveLength(3);
    }
  });
});
