import { NextResponse } from "next/server";
import { QUIZ_QUESTIONS } from "@vesna/shared";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ questions: QUIZ_QUESTIONS });
}
