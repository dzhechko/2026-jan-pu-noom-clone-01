import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { requireAuth } from "@/lib/auth";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/engines/notification-engine";
import { prefsUpdateSchema } from "@/lib/validators/notifications";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const result = await getNotificationPrefs(authResult.user.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[notifications/preferences] GET", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: Request): Promise<NextResponse> {
  try {
    const authResult = requireAuth(req);
    if ("error" in authResult) {
      const { body, status } = authResult.error;
      return NextResponse.json(body, { status });
    }

    const rawBody = await req.json();
    const parsed = prefsUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      const { body, status } = apiError("NOTIF_002", {
        fields: parsed.error.flatten().fieldErrors,
      });
      return NextResponse.json(body, { status });
    }

    const result = await updateNotificationPrefs(
      authResult.user.userId,
      parsed.data,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[notifications/preferences] PATCH", error);
    const { body, status } = apiError("GEN_001");
    return NextResponse.json(body, { status });
  }
}
