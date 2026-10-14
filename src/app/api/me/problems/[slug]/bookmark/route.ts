import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, jsonError } from "@/lib/http";
import { setBookmark } from "@/lib/progress";

const body = z.object({ bookmarked: z.boolean() });

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSameOrigin(req)) return jsonError(403, "Cross-origin request refused");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in first");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid request");
  if (!(await setBookmark(user.id, slug, parsed.data.bookmarked))) return jsonError(404, "Not found");
  return NextResponse.json({ bookmarked: parsed.data.bookmarked });
}
