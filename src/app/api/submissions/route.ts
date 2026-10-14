import { NextResponse } from "next/server";
import { createSubmission, createSubmissionInput, NotFoundError } from "@/lib/submissions";

export async function POST(req: Request) {
  const parsed = createSubmissionInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const id = await createSubmission(parsed.data);
    return NextResponse.json({ id }, { status: 202 });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
    throw err;
  }
}
