import { NextResponse, type NextRequest } from "next/server";

// v0 auth: HTTP Basic Auth gating /(agent)/* and /api/agent/*.
// Swap for Supabase Auth in a later slab.
//
// Configure with AGENT_USER (default "agent") and AGENT_PASSWORD (required)
// env vars. If AGENT_PASSWORD is unset, requests are 503'd — fail closed.

const AGENT_PATH = /^\/(?:\(agent\)|artists|calendar|offers)(?:\/|$)/;
const AGENT_API = /^\/api\/agent(?:\/|$)/;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!AGENT_PATH.test(pathname) && !AGENT_API.test(pathname)) {
    return NextResponse.next();
  }

  const expectedUser = process.env.AGENT_USER || "agent";
  const expectedPassword = process.env.AGENT_PASSWORD;

  if (!expectedPassword) {
    return new NextResponse(
      "AGENT_PASSWORD env var must be set before agent routes are accessible.",
      { status: 503 },
    );
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice("Basic ".length));
      const sep = decoded.indexOf(":");
      if (sep > -1) {
        const user = decoded.slice(0, sep);
        const pass = decoded.slice(sep + 1);
        if (user === expectedUser && pass === expectedPassword) {
          return NextResponse.next();
        }
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Booking Bot agent", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/artists/:path*", "/calendar/:path*", "/offers/:path*", "/api/agent/:path*"],
};
