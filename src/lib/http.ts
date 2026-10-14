import "server-only";
import { NextResponse } from "next/server";

// Cookie-authenticated mutations must come from our own pages. SameSite=Lax already
// keeps the cookie off cross-site requests; this is a second, explicit check.
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers, and non-browser clients without our cookie
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const jsonError = (status: number, error: string, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });
