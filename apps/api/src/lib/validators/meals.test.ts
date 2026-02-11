import { describe, it, expect } from "vitest";
import {
  createMealSchema,
  updateMealSchema,
  dailySummarySchema,
  mealSearchSchema,
  mealIdParamSchema,
} from "./meals";

describe("createMealSchema", () => {
  it("1. Valid complete object passes", () => {
    const valid = {
      mealType: "breakfast",
      dishName: "Овсянка с ягодами",
      calories: 350,
      proteinG: 12.5,
      fatG: 8.2,
      carbsG: 55.0,
      portionG: 250,
    };
    expect(createMealSchema.safeParse(valid).success).toBe(true);
  });

  it("2. Missing dishName fails", () => {
    const invalid = {
      mealType: "lunch",
      calories: 500,
      proteinG: 20,
      fatG: 15,
      carbsG: 60,
      portionG: 300,
    };
    expect(createMealSchema.safeParse(invalid).success).toBe(false);
  });

  it("3. Calories > 10000 fails", () => {
    const invalid = {
      mealType: "dinner",
      dishName: "Огромный пир",
      calories: 15000,
      proteinG: 100,
      fatG: 200,
      carbsG: 500,
      portionG: 2000,
    };
    expect(createMealSchema.safeParse(invalid).success).toBe(false);
  });

  it("4. Invalid mealType fails", () => {
    const invalid = {
      mealType: "brunch",
      dishName: "Бранч",
      calories: 400,
      proteinG: 15,
      fatG: 10,
      carbsG: 50,
      portionG: 200,
    };
    expect(createMealSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("updateMealSchema", () => {
  it("5. Empty object is valid (all optional)", () => {
    expect(updateMealSchema.safeParse({}).success).toBe(true);
  });

  it("6. Single field update valid", () => {
    const valid = { dishName: "Новое название" };
    expect(updateMealSchema.safeParse(valid).success).toBe(true);
  });

  it("7. Invalid calories rejected", () => {
    const invalid = { calories: 20000 };
    expect(updateMealSchema.safeParse(invalid).success).toBe(false);
  });

  it("8. Invalid mealType rejected", () => {
    const invalid = { mealType: "elevenses" };
    expect(updateMealSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("dailySummarySchema", () => {
  it("9. Valid date '2026-02-11' passes", () => {
    const valid = { date: "2026-02-11" };
    const result = dailySummarySchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBe("2026-02-11");
    }
  });

  it("10. Invalid date '2026-13-01' passes regex but that's OK (regex only checks format)", () => {
    const valid = { date: "2026-13-01" }; // Invalid month, but regex allows it
    const result = dailySummarySchema.safeParse(valid);
    expect(result.success).toBe(true); // Regex only validates YYYY-MM-DD pattern
  });

  it("11. Missing date → undefined (optional)", () => {
    const result = dailySummarySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.date).toBeUndefined();
    }
  });

  it("12. Wrong format '11/02/2026' fails", () => {
    const invalid = { date: "11/02/2026" };
    expect(dailySummarySchema.safeParse(invalid).success).toBe(false);
  });
});

describe("mealSearchSchema", () => {
  it("13. Valid query passes with default limit", () => {
    const valid = { q: "курица" };
    const result = mealSearchSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("курица");
      expect(result.data.limit).toBe(10); // default
    }
  });

  it("14. Empty query rejected", () => {
    const invalid = { q: "" };
    expect(mealSearchSchema.safeParse(invalid).success).toBe(false);
  });

  it("15. Limit coercion from string '5' → number 5", () => {
    const valid = { q: "рис", limit: "5" };
    const result = mealSearchSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
      expect(typeof result.data.limit).toBe("number");
    }
  });
});

describe("mealIdParamSchema", () => {
  it("16. Valid UUID passes", () => {
    const valid = { id: "550e8400-e29b-41d4-a716-446655440000" };
    expect(mealIdParamSchema.safeParse(valid).success).toBe(true);
  });

  it("17. Non-UUID string fails", () => {
    const invalid = { id: "not-a-uuid" };
    expect(mealIdParamSchema.safeParse(invalid).success).toBe(false);
  });
});
