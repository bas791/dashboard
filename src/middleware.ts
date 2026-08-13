import { NextRequest, NextResponse } from "next/server";

/**
 * Optional password gate for the whole dashboard, designed for hosted
 * deployments. Set DASHBOARD_PASSWORD and every request must present it via
 * HTTP Basic auth — the browser shows a native login prompt once and
 * remembers it for the session (works on TV browsers too; any username).
 * Unset (e.g. local development), everything passes through untouched.
 */
export function middleware(request: NextRequest): NextResponse {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === password) return NextResponse.next();
    } catch {
      // Malformed header — fall through to the challenge.
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Sales Dashboard"' },
  });
}

export const config = {
  // Protect everything except Next's static assets (which contain no data).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
