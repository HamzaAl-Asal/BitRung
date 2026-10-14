import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getSubmissionDto } from "@/lib/submissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return jsonError(401, "Sign in first");
  // Someone else's submission is a 404, not a 403, so ids can't be probed.
  const dto = await getSubmissionDto(user.id, params.id);
  if (!dto) return jsonError(404, "Not found");
  return NextResponse.json(dto, { headers: { "Cache-Control": "no-store" } });
}
