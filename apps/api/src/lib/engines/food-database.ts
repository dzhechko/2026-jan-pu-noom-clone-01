import { readFile } from "fs/promises";
import { join } from "path";

export interface FoodItem {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
}

interface ScoredFoodItem extends FoodItem {
  score: number;
}

let cachedFoodDatabase: FoodItem[] | null = null;

/**
 * Load food database from static JSON file
 * Cached in memory after first load
 */
async function loadFoodDatabase(): Promise<FoodItem[]> {
  if (cachedFoodDatabase !== null) {
    return cachedFoodDatabase;
  }

  const filePath = join(process.cwd(), "..", "..", "content", "food-database.json");
  const fileContent = await readFile(filePath, "utf-8");
  cachedFoodDatabase = JSON.parse(fileContent) as FoodItem[];
  return cachedFoodDatabase;
}

/**
 * Calculate match score for a food item against a query
 * Scoring:
 * - Exact match: 100
 * - Prefix match (startsWith): 80
 * - Substring match (includes): 60
 * - Partial word match: 20 + (matched/total * 30)
 * - No match: 0
 */
function calculateScore(foodName: string, query: string): number {
  const foodLower = foodName.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (foodLower === queryLower) {
    return 100;
  }

  // Prefix match
  if (foodLower.startsWith(queryLower)) {
    return 80;
  }

  // Substring match
  if (foodLower.includes(queryLower)) {
    return 60;
  }

  // Partial word match
  const foodWords = foodLower.split(/\s+/);
  const queryWords = queryLower.split(/\s+/);
  let matchedWords = 0;

  for (const queryWord of queryWords) {
    if (foodWords.some(foodWord => foodWord.includes(queryWord) || queryWord.includes(foodWord))) {
      matchedWords++;
    }
  }

  if (matchedWords > 0) {
    return 20 + (matchedWords / queryWords.length) * 30;
  }

  return 0;
}

/**
 * Search food database by query string
 * Returns scored and sorted results, limited by limit parameter
 *
 * @param query - Search query (case insensitive)
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of matching food items, sorted by relevance score
 */
export async function searchFood(query: string, limit: number = 10): Promise<FoodItem[]> {
  // Guard: empty query returns empty results
  if (!query || query.trim().length === 0) {
    return [];
  }

  const database = await loadFoodDatabase();
  const trimmedQuery = query.trim();

  // Score all items
  const scoredItems: ScoredFoodItem[] = database
    .map(item => ({
      ...item,
      score: calculateScore(item.name, trimmedQuery)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Remove score field before returning
  return scoredItems.map(({ score, ...item }) => item);
}

/**
 * Lookup exact or best match for a dish name
 * Returns first search result or null if no match
 *
 * @param dishName - Dish name to look up
 * @returns Food item or null
 */
export async function lookupFood(dishName: string): Promise<FoodItem | null> {
  const results = await searchFood(dishName, 1);
  return results.length > 0 ? results[0] : null;
}
