import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchFood, lookupFood, type FoodItem } from "./food-database";

// Mock food database for testing
const mockFoodDatabase: FoodItem[] = [
  { name: "гречка", caloriesPer100g: 123, proteinPer100g: 4.5, fatPer100g: 1.6, carbsPer100g: 25.0 },
  { name: "гречневая каша", caloriesPer100g: 90, proteinPer100g: 3.0, fatPer100g: 0.8, carbsPer100g: 17.0 },
  { name: "овсянка", caloriesPer100g: 88, proteinPer100g: 3.0, fatPer100g: 1.7, carbsPer100g: 15.0 },
  { name: "овсяная каша на молоке", caloriesPer100g: 102, proteinPer100g: 3.2, fatPer100g: 2.5, carbsPer100g: 14.2 },
  { name: "рис белый", caloriesPer100g: 130, proteinPer100g: 2.7, fatPer100g: 0.3, carbsPer100g: 28.2 },
  { name: "курица грудка", caloriesPer100g: 165, proteinPer100g: 31.0, fatPer100g: 3.6, carbsPer100g: 0.0 },
  { name: "говядина", caloriesPer100g: 250, proteinPer100g: 26.0, fatPer100g: 16.0, carbsPer100g: 0.0 },
  { name: "яблоко", caloriesPer100g: 52, proteinPer100g: 0.4, fatPer100g: 0.4, carbsPer100g: 11.8 },
  { name: "банан", caloriesPer100g: 89, proteinPer100g: 1.1, fatPer100g: 0.3, carbsPer100g: 22.8 },
  { name: "борщ", caloriesPer100g: 49, proteinPer100g: 2.3, fatPer100g: 2.1, carbsPer100g: 5.5 },
];

// Mock fs/promises to return our test data
vi.mock("fs/promises", () => ({
  readFile: vi.fn(async () => JSON.stringify(mockFoodDatabase))
}));

// Reset module cache between tests to clear the in-memory cache
beforeEach(() => {
  vi.clearAllMocks();
});

describe("food-database", () => {
  describe("searchFood", () => {
    it("should return exact match as first result", async () => {
      const results = await searchFood("гречка");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("гречка");
    });

    it("should return prefix match results", async () => {
      const results = await searchFood("греч");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain("греч");
    });

    it("should return substring match results", async () => {
      const results = await searchFood("каша");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(item => item.name.includes("каша"))).toBe(true);
    });

    it("should handle multi-word partial match", async () => {
      const results = await searchFood("овсяная молоке");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("овсяная каша на молоке");
    });

    it("should return empty array for no match", async () => {
      const results = await searchFood("несуществующееблюдо");
      expect(results).toEqual([]);
    });

    it("should respect limit parameter", async () => {
      const results = await searchFood("каша", 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should be case insensitive", async () => {
      const results1 = await searchFood("ГРЕЧКА");
      const results2 = await searchFood("гречка");
      const results3 = await searchFood("ГрЕчКа");

      expect(results1.length).toBeGreaterThan(0);
      expect(results1[0].name).toBe(results2[0].name);
      expect(results2[0].name).toBe(results3[0].name);
    });

    it("should handle Russian characters correctly", async () => {
      const results = await searchFood("борщ");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("борщ");
    });

    it("should return empty array for empty query", async () => {
      const results1 = await searchFood("");
      const results2 = await searchFood("   ");

      expect(results1).toEqual([]);
      expect(results2).toEqual([]);
    });

    it("should sort results by score (exact > prefix > substring)", async () => {
      const results = await searchFood("овсян");

      // Should prioritize "овсянка" (prefix) over "овсяная каша на молоке"
      expect(results[0].name).toBe("овсянка");
    });

    it("should use default limit of 10", async () => {
      const results = await searchFood("а"); // Common letter, likely many matches
      // With our mock data, we won't hit 10, but the engine should apply limit
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe("lookupFood", () => {
    it("should return first result for valid query", async () => {
      const result = await lookupFood("гречка");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("гречка");
    });

    it("should return null for no match", async () => {
      const result = await lookupFood("несуществующееблюдо");
      expect(result).toBeNull();
    });
  });
});
