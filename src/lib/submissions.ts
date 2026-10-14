import "server-only";
import { z } from "zod";
import { prisma } from "./prisma";
import { judgeSubmission } from "./judge";
import { markAttempted } from "./progress";

export const MAX_SOURCE_BYTES = 64 * 1024;
export const DAILY_LIMITS = { Submit: 20, SampleRun: 60 } as const;
// A run still pending after this long was lost (for example the server restarted mid-judge).
export const STALE_AFTER_MS = 2 * 60 * 1000;

export const createSubmissionInput = z.object({
  problemSlug: z.string().min(1).max(120),
  languageId: z.number().int().positive(),
  sourceCode: z
    .string()
    .min(1)
    .refine((s) => Buffer.byteLength(s, "utf8") <= MAX_SOURCE_BYTES, `Source is over ${MAX_SOURCE_BYTES / 1024} KB`),
  kind: z.enum(["Submit", "SampleRun"]).default("Submit"),
});
export type CreateSubmissionInput = z.infer<typeof createSubmissionInput>;

export class SubmissionError extends Error {
  constructor(
    readonly status: 404 | 409 | 429,
    message: string,
  ) {
    super(message);
  }
}

const startOfUtcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function usedToday(userId: string) {
  const rows = await prisma.submission.groupBy({
    by: ["kind"],
    where: { userId, createdAt: { gte: startOfUtcDay() } },
    _count: true,
  });
  const used = { Submit: 0, SampleRun: 0 };
  for (const r of rows) used[r.kind] = r._count;
  return used;
}

export async function createSubmission(userId: string, input: CreateSubmissionInput) {
  const problem = await prisma.problem.findFirst({
    where: { slug: input.problemSlug, status: "Published" },
    select: { id: true, languages: { select: { languageId: true, language: { select: { isEnabled: true } } } } },
  });
  if (!problem) throw new SubmissionError(404, "Problem not found");
  // Server-side language allowlist: enabled and offered for this problem.
  if (!problem.languages.some((l) => l.languageId === input.languageId && l.language.isEnabled)) {
    throw new SubmissionError(404, "Language not available for this problem");
  }

  const id = await prisma.$transaction(async (tx) => {
    // Serialise this user's submissions so parallel requests can't slip past the limits.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    // Lost runs become judge errors instead of blocking this user forever.
    await tx.submission.updateMany({
      where: { userId, status: { in: ["Queued", "Processing"] }, createdAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
      data: { status: "InternalError", completedAt: new Date() },
    });
    const pending = await tx.submission.count({ where: { userId, status: { in: ["Queued", "Processing"] } } });
    if (pending > 0) throw new SubmissionError(409, "Your previous run is still being judged");
    const used = await tx.submission.count({ where: { userId, kind: input.kind, createdAt: { gte: startOfUtcDay() } } });
    if (used >= DAILY_LIMITS[input.kind]) {
      throw new SubmissionError(
        429,
        input.kind === "Submit"
          ? `Daily limit of ${DAILY_LIMITS.Submit} submissions reached. It resets at midnight UTC.`
          : `Daily limit of ${DAILY_LIMITS.SampleRun} sample runs reached. It resets at midnight UTC.`,
      );
    }
    const sub = await tx.submission.create({
      data: { userId, problemId: problem.id, languageId: input.languageId, sourceCode: input.sourceCode, kind: input.kind },
      select: { id: true },
    });
    return sub.id;
  });

  if (input.kind === "Submit") await markAttempted(userId, problem.id);

  // Fire and forget: fine under a long-running `next start` process.
  // Production needs a durable queue or Judge0 callbacks instead (see plan review).
  void judgeSubmission(id);
  return id;
}

// DTO: verdict data only, and only the owner's. Never includes test inputs or expected outputs.
export async function getSubmissionDto(userId: string, id: string) {
  const s = await prisma.submission.findFirst({
    where: { id, userId },
    select: {
      id: true,
      kind: true,
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
    kind: s.kind,
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
      .map((r, i) => ({ n: i + 1, status: r.status })),
  };
}
