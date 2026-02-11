import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: {
        code: "GEN_002",
        message: "VK OAuth будет доступен в следующей версии",
      },
    },
    { status: 501 }
  );
}
