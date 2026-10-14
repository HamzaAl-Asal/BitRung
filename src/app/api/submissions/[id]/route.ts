import { NextResponse } from "next/server";
import { getSubmissionDto } from "@/lib/submissions";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const dto = await getSubmissionDto(params.id);
  if (!dto) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(dto);
}
