import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOrigin, jsonError } from "@/lib/http";
import { createSubmission, createSubmissionInput, SubmissionError, usedToday } from "@/lib/submissions";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return jsonError(403, "Cross-origin request refused");
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in to submit");

  const parsed = createSubmissionInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Invalid request", { issues: parsed.error.issues });

  try {
    const id = await createSubmission(user.id, parsed.data);
    return NextResponse.json({ id, usedToday: await usedToday(user.id) }, { status: 202 });
  } catch (err) {
    if (err instanceof SubmissionError) return jsonError(err.status, err.message);
    throw err;
  }
}
