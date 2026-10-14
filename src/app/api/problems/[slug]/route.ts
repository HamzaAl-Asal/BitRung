import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getProblemDetail } from "@/lib/problems";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  const problem = await getProblemDetail(params.slug, user?.id ?? null);
  if (!problem) return jsonError(404, "Not found");
  const { id: _internalId, ...dto } = problem;
  return NextResponse.json(dto);
}
