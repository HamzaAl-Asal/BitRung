import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { catalogueQuery, listProblems } from "@/lib/problems";

export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const user = await getCurrentUser();
  return NextResponse.json(await listProblems(catalogueQuery.parse(params), user?.id ?? null));
}
