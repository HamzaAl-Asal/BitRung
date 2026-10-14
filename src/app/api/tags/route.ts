import { NextResponse } from "next/server";
import { listTags } from "@/lib/problems";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listTags());
}
