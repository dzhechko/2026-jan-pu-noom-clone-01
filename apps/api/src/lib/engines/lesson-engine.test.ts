import { describe, it, expect } from "vitest";
import {
  computeLessonList,
  checkLessonAccess,
  gradeQuiz,
  stripQuizAnswers,
} from "./lesson-engine";
import type { LessonContentFull } from "@vesna/shared";

// Helper to create progress records
function progress(lessonId: number, status: string) {
  return { lessonId, status, quizScore: status === "completed" ? 3 : null, xpEarned: status === "completed" ? 15 : 0 };
}

describe("computeLessonList", () => {
  it("returns all 14 lessons with correct defaults for new user", () => {
    const list = computeLessonList([], "free");
    expect(list).toHaveLength(14);
    expect(list[0].status).toBe("available"); // lesson 1 is available
    expect(list[0].title).toBe("Что такое CBT и как оно работает");
    for (let i = 1; i < 14; i++) {
      expect(list[i].status).toBe("locked");
    }
  });

  it("unlocks next lesson after completing one", () => {
    const list = computeLessonList([progress(1, "completed")], "free");
    expect(list[0].status).toBe("completed");
    expect(list[1].status).toBe("available"); // lesson 2
    expect(list[2].status).toBe("locked");
  });

  it("review_needed counts as done for unlocking", () => {
    const list = computeLessonList(
      [progress(1, "completed"), { lessonId: 2, status: "review_needed", quizScore: 1, xpEarned: 5 }],
      "premium"
    );
    expect(list[1].status).toBe("review_needed");
    expect(list[2].status).toBe("available"); // lesson 3 unlocked
  });

  it("shows paywall for free users on lesson 4+", () => {
    const records = [1, 2, 3].map((id) => progress(id, "completed"));
    const list = computeLessonList(records, "free");
    expect(list[2].status).toBe("completed"); // lesson 3
    expect(list[3].status).toBe("paywall"); // lesson 4
  });

  it("shows available for premium users on lesson 4+", () => {
    const records = [1, 2, 3].map((id) => progress(id, "completed"));
    const list = computeLessonList(records, "premium");
    expect(list[3].status).toBe("available"); // lesson 4
  });

  it("preserves quizScore and xpEarned from progress", () => {
    const list = computeLessonList(
      [{ lessonId: 1, status: "completed", quizScore: 2, xpEarned: 10 }],
      "free"
    );
    expect(list[0].quizScore).toBe(2);
    expect(list[0].xpEarned).toBe(10);
  });

  it("clinical tier behaves like premium", () => {
    const records = [1, 2, 3].map((id) => progress(id, "completed"));
    const list = computeLessonList(records, "clinical");
    expect(list[3].status).toBe("available");
  });
});

describe("checkLessonAccess", () => {
  it("allows access to lesson 1 for new user", () => {
    expect(checkLessonAccess(1, "free", [])).toEqual({ allowed: true });
  });

  it("denies access to lesson 2 without completing lesson 1", () => {
    expect(checkLessonAccess(2, "free", [])).toEqual({
      allowed: false,
      errorCode: "LESSON_003",
    });
  });

  it("allows access to completed lessons", () => {
    const records = [{ lessonId: 1, status: "completed" }];
    expect(checkLessonAccess(1, "free", records)).toEqual({ allowed: true });
  });

  it("allows access to next sequential lesson", () => {
    const records = [{ lessonId: 1, status: "completed" }];
    expect(checkLessonAccess(2, "free", records)).toEqual({ allowed: true });
  });

  it("denies free user access to lesson 4", () => {
    const records = [1, 2, 3].map((id) => ({ lessonId: id, status: "completed" }));
    expect(checkLessonAccess(4, "free", records)).toEqual({
      allowed: false,
      errorCode: "LESSON_001",
    });
  });

  it("allows premium user access to lesson 4", () => {
    const records = [1, 2, 3].map((id) => ({ lessonId: id, status: "completed" }));
    expect(checkLessonAccess(4, "premium", records)).toEqual({ allowed: true });
  });

  it("denies access to lesson 5 when only 1-3 completed", () => {
    const records = [1, 2, 3].map((id) => ({ lessonId: id, status: "completed" }));
    expect(checkLessonAccess(5, "premium", records)).toEqual({
      allowed: false,
      errorCode: "LESSON_003",
    });
  });

  it("review_needed counts as done for sequential unlock", () => {
    const records = [
      { lessonId: 1, status: "completed" },
      { lessonId: 2, status: "review_needed" },
    ];
    expect(checkLessonAccess(3, "premium", records)).toEqual({ allowed: true });
  });
});

describe("gradeQuiz", () => {
  const correct = [0, 1, 2];

  it("perfect score (3/3) gives 15 XP and completed", () => {
    const result = gradeQuiz([0, 1, 2], correct, 0, false);
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true);
    expect(result.xpEarned).toBe(15);
    expect(result.status).toBe("completed");
    expect(result.shouldSave).toBe(true);
    expect(result.attemptsUsed).toBe(1);
  });

  it("passing score (2/3) gives 10 XP and completed", () => {
    const result = gradeQuiz([0, 1, 0], correct, 0, false);
    expect(result.score).toBe(2);
    expect(result.passed).toBe(true);
    expect(result.xpEarned).toBe(10);
    expect(result.status).toBe("completed");
    expect(result.shouldSave).toBe(true);
  });

  it("failing score (1/3) on first attempt → no save, retry available", () => {
    const result = gradeQuiz([0, 0, 0], correct, 0, false);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.xpEarned).toBe(0);
    expect(result.shouldSave).toBe(false);
    expect(result.attemptsUsed).toBe(1);
    expect(result.attemptsRemaining).toBe(2);
  });

  it("failing on 3rd attempt → review_needed with 5 XP", () => {
    const result = gradeQuiz([0, 0, 0], correct, 2, false);
    expect(result.score).toBe(1);
    expect(result.passed).toBe(false);
    expect(result.xpEarned).toBe(5);
    expect(result.status).toBe("review_needed");
    expect(result.shouldSave).toBe(true);
    expect(result.attemptsRemaining).toBe(0);
  });

  it("0/3 score on max attempts", () => {
    const result = gradeQuiz([3, 3, 3], correct, 2, false);
    expect(result.score).toBe(0);
    expect(result.status).toBe("review_needed");
    expect(result.xpEarned).toBe(5);
  });

  it("already completed returns no-op", () => {
    const result = gradeQuiz([0, 1, 2], correct, 1, true);
    expect(result.shouldSave).toBe(false);
    expect(result.xpEarned).toBe(0);
  });

  it("passing on 2nd attempt still gives full XP", () => {
    const result = gradeQuiz([0, 1, 2], correct, 1, false);
    expect(result.passed).toBe(true);
    expect(result.xpEarned).toBe(15);
    expect(result.attemptsUsed).toBe(2);
    expect(result.attemptsRemaining).toBe(1);
  });
});

describe("stripQuizAnswers", () => {
  it("removes correctAnswer from all questions", () => {
    const content: LessonContentFull = {
      id: 1,
      title: "Test",
      description: "Desc",
      sections: {
        theory: "Theory",
        example: "Example",
        quiz: {
          questions: [
            { id: 1, question: "Q1?", options: ["A", "B", "C", "D"], correctAnswer: 0 },
            { id: 2, question: "Q2?", options: ["A", "B", "C", "D"], correctAnswer: 2 },
            { id: 3, question: "Q3?", options: ["A", "B", "C", "D"], correctAnswer: 1 },
          ],
        },
        assignment: "Do this",
      },
    };

    const stripped = stripQuizAnswers(content);

    for (const q of stripped.sections.quiz.questions) {
      expect(q).not.toHaveProperty("correctAnswer");
      expect(q).toHaveProperty("id");
      expect(q).toHaveProperty("question");
      expect(q).toHaveProperty("options");
    }
  });

  it("preserves other content fields", () => {
    const content: LessonContentFull = {
      id: 5,
      title: "Title",
      description: "Desc",
      sections: {
        theory: "The theory",
        example: "The example",
        quiz: {
          questions: [
            { id: 1, question: "Q?", options: ["A", "B", "C", "D"], correctAnswer: 0 },
          ],
        },
        assignment: "Assignment text",
      },
    };

    const stripped = stripQuizAnswers(content);
    expect(stripped.id).toBe(5);
    expect(stripped.title).toBe("Title");
    expect(stripped.sections.theory).toBe("The theory");
    expect(stripped.sections.assignment).toBe("Assignment text");
  });
});
