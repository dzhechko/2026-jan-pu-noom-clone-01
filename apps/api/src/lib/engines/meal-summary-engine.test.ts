import { describe, it, expect } from "vitest";
import { computeDailySummary } from "./meal-summary-engine";
import { Decimal } from "@prisma/client/runtime/library";

describe("computeDailySummary", () => {
  it("returns all zeros with green status for empty meals array", () => {
    const result = computeDailySummary([], 2000);

    expect(result.totalCalories).toBe(0);
    expect(result.totalProteinG).toBe(0);
    expect(result.totalFatG).toBe(0);
    expect(result.totalCarbsG).toBe(0);
    expect(result.targetCalories).toBe(2000);
    expect(result.status).toBe("green");
  });

  it("returns green status when under target", () => {
    const meals = [
      { calories: 500, proteinG: 20, fatG: 15, carbsG: 50 },
      { calories: 600, proteinG: 25, fatG: 20, carbsG: 60 },
      { calories: 700, proteinG: 30, fatG: 25, carbsG: 70 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(1800);
    expect(result.totalProteinG).toBe(75);
    expect(result.totalFatG).toBe(60);
    expect(result.totalCarbsG).toBe(180);
    expect(result.status).toBe("green");
  });

  it("returns green status at exact target boundary", () => {
    const meals = [
      { calories: 1000, proteinG: 40, fatG: 30, carbsG: 100 },
      { calories: 1000, proteinG: 40, fatG: 30, carbsG: 100 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(2000);
    expect(result.status).toBe("green");
  });

  it("returns yellow status when slightly over target (1.05x)", () => {
    const meals = [
      { calories: 2100, proteinG: 80, fatG: 70, carbsG: 200 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(2100);
    expect(result.status).toBe("yellow");
  });

  it("returns yellow status at yellow boundary (1.15x)", () => {
    const meals = [
      { calories: 1150, proteinG: 50, fatG: 40, carbsG: 120 },
      { calories: 1150, proteinG: 50, fatG: 40, carbsG: 120 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(2300); // exactly 2000 * 1.15
    expect(result.status).toBe("yellow");
  });

  it("returns red status when over 1.15x target", () => {
    const meals = [
      { calories: 1200, proteinG: 50, fatG: 45, carbsG: 130 },
      { calories: 1200, proteinG: 50, fatG: 45, carbsG: 130 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(2400); // 2000 * 1.2
    expect(result.status).toBe("red");
  });

  it("correctly converts Decimal values from Prisma to numbers", () => {
    const meals = [
      {
        calories: 600,
        proteinG: new Decimal("25.5"),
        fatG: new Decimal("18.75"),
        carbsG: new Decimal("65.25"),
      },
      {
        calories: 800,
        proteinG: new Decimal("35.5"),
        fatG: new Decimal("22.25"),
        carbsG: new Decimal("85.75"),
      },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(1400);
    expect(result.totalProteinG).toBe(61); // 25.5 + 35.5
    expect(result.totalFatG).toBe(41); // 18.75 + 22.25
    expect(result.totalCarbsG).toBe(151); // 65.25 + 85.75
    expect(result.status).toBe("green");
  });

  it("uses default target of 2000 when not provided", () => {
    const meals = [
      { calories: 1500, proteinG: 60, fatG: 50, carbsG: 150 },
    ];

    const result = computeDailySummary(meals);

    expect(result.targetCalories).toBe(2000);
    expect(result.status).toBe("green");
  });

  it("respects custom target calories", () => {
    const meals = [
      { calories: 1600, proteinG: 70, fatG: 55, carbsG: 160 },
    ];

    const result = computeDailySummary(meals, 1500);

    expect(result.targetCalories).toBe(1500);
    expect(result.totalCalories).toBe(1600);
    expect(result.status).toBe("yellow"); // 1600 > 1500 but <= 1725 (1500 * 1.15)
  });

  it("handles single meal day calculation correctly", () => {
    const meals = [
      { calories: 450, proteinG: 20, fatG: 15, carbsG: 50 },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(450);
    expect(result.totalProteinG).toBe(20);
    expect(result.totalFatG).toBe(15);
    expect(result.totalCarbsG).toBe(50);
    expect(result.status).toBe("green");
  });

  it("treats targetCalories of 0 as green to avoid division by zero", () => {
    const meals = [
      { calories: 500, proteinG: 20, fatG: 15, carbsG: 50 },
    ];

    const result = computeDailySummary(meals, 0);

    expect(result.targetCalories).toBe(0);
    expect(result.totalCalories).toBe(500);
    expect(result.status).toBe("green");
  });

  it("handles mixed Decimal and number inputs", () => {
    const meals = [
      {
        calories: 700,
        proteinG: 30,
        fatG: new Decimal("25.5"),
        carbsG: 80,
      },
      {
        calories: 900,
        proteinG: new Decimal("40.5"),
        fatG: 30,
        carbsG: new Decimal("95.75"),
      },
    ];

    const result = computeDailySummary(meals, 2000);

    expect(result.totalCalories).toBe(1600);
    expect(result.totalProteinG).toBe(70.5); // 30 + 40.5
    expect(result.totalFatG).toBe(55.5); // 25.5 + 30
    expect(result.totalCarbsG).toBe(175.75); // 80 + 95.75
    expect(result.status).toBe("green");
  });
});
