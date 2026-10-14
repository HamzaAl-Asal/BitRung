import "server-only";
import { z } from "zod";
import { prisma } from "./prisma";
import { judgeSubmission } from "./judge";

// Skeleton has no auth yet. Every submission belongs to this stand-in user.
export const DEV_USER_ID = "dev-user";
export const MAX_SOURCE_BYTES = 64 * 1024;

export const createSubmissionInput = z.object({
  problemSlug: z.string().min(1).max(120),
  languageId: z.number().int().positive(),
  sourceCode: z.string().min(1).max(MAX_SOURCE_BYTES),
});

export class NotFoundError extends Error {}

export async function createSubmission(input: z.infer<typeof createSubmissionInput>) {
  const problem = await prisma.problem.findFirst({
    where: { slug: input.problemSlug, status: "Published" },
    select: { id: true, languages: { select: { languageId: true, language: { select: { isEnabled: true } } } } },
  });
  if (!problem) throw new NotFoundError("Problem not found");
  // Server-side language allowlist: enabled and offered for this problem.
  const allowed = problem.languages.some((l) => l.languageId === input.languageId && l.language.isEnabled);
  if (!allowed) throw new NotFoundError("Language not available for this problem");

  const sub = await prisma.submission.create({
    data: {
      userId: DEV_USER_ID,
      problemId: problem.id,
      languageId: input.languageId,
      sourceCode: input.sourceCode,
    },
    select: { id: true },
  });

  // Fire and forget: fine under a long-running `next dev`/`next start` process.
  // Production needs a durable queue or Judge0 callbacks instead (see plan review).
  void judgeSubmission(sub.id);
  return sub.id;
}

// DTO: verdict data only. Never includes test inputs or expected outputs.
export async function getSubmissionDto(id: string) {
  const s = await prisma.submission.findFirst({
    where: { id, userId: DEV_USER_ID },
    select: {
      id: true,
      status: true,
      passedCount: true,
      totalCount: true,
      executionTimeMs: true,
      memoryUsedKb: true,
      compilerOutput: true,
      createdAt: true,
      completedAt: true,
      language: { select: { name: true } },
      results: { select: { status: true, testCase: { select: { sequence: true } } } },
    },
  });
  if (!s) return null;
  return {
    id: s.id,
    status: s.status,
    language: s.language.name,
    passedCount: s.passedCount,
    totalCount: s.totalCount,
    executionTimeMs: s.executionTimeMs,
    memoryUsedKb: s.memoryUsedKb,
    compilerOutput: s.compilerOutput,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    tests: s.results
      .sort((a, b) => a.testCase.sequence - b.testCase.sequence)
      .map((r) => ({ n: r.testCase.sequence, status: r.status })),
  };
}
