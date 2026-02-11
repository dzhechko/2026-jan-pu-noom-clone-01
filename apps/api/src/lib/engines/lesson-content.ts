import { readFile } from "fs/promises";
import { join } from "path";
import type { LessonContentFull } from "@vesna/shared";
import { TOTAL_LESSONS } from "@vesna/shared";

const cache = new Map<number, LessonContentFull>();

function getContentPath(lessonId: number): string {
  const padded = String(lessonId).padStart(2, "0");
  return join(process.cwd(), "..", "..", "content", "lessons", `lesson-${padded}.json`);
}

export async function loadLessonContent(lessonId: number): Promise<LessonContentFull | null> {
  if (lessonId < 1 || lessonId > TOTAL_LESSONS) {
    return null;
  }

  const cached = cache.get(lessonId);
  if (cached) {
    return cached;
  }

  try {
    const filePath = getContentPath(lessonId);
    const raw = await readFile(filePath, "utf-8");
    const content: LessonContentFull = JSON.parse(raw);
    cache.set(lessonId, content);
    return content;
  } catch {
    return null;
  }
}

export function clearContentCache(): void {
  cache.clear();
}
