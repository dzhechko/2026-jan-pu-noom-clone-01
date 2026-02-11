import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const isApiRoute = request.nextUrl.pathname.startsWith("/api");

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (isApiRoute) {
    // API routes: strict framing policy
    response.headers.set("X-Frame-Options", "DENY");
  }
  // Non-API routes: allow Telegram Mini App iframe embedding (no X-Frame-Options)

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
