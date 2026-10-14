import "server-only";
import type { SubmissionStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { submitBatch, getBatch, isFinished, type Judge0Result } from "./judge0";
import { check } from "./checker";

const POLL_TIMEOUT_MS = 60_000;

function mapStatus(r: Judge0Result, passed: boolean): SubmissionStatus {
  if (r.statusId === 6) return "CompilationError";
  if (r.statusId === 5) return "TimeLimitExceeded";
  if (r.statusId >= 7 && r.statusId <= 12) return "RuntimeError";
  if (r.statusId === 3) return passed ? "Accepted" : "WrongAnswer";
  return "InternalError";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Runs every test of the submission's problem through Judge0 and records the verdict.
// The overall verdict is the first failing test's verdict, Codeforces-style.
export async function judgeSubmission(submissionId: string): Promise<void> {
  const sub = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      language: true,
      problem: { include: { testCases: { orderBy: { sequence: "asc" } } } },
    },
  });
  const { problem, language } = sub;
  const tests = problem.testCases;

  try {
    await prisma.submission.update({
      where: { id: sub.id },
      data: { status: "Processing", totalCount: tests.length },
    });

    const tokens = await submitBatch(
      tests.map((t) => ({
        languageId: language.judge0LanguageId,
        sourceCode: sub.sourceCode,
        stdin: t.input,
        cpuTimeLimitSec: (problem.timeLimitMs * language.timeMultiplier) / 1000,
        memoryLimitKb: problem.memoryLimitMb * 1024,
        compilerOptions: language.compilerArgs,
      })),
    );

    await prisma.submissionTestResult.createMany({
      data: tests.map((t, i) => ({
        submissionId: sub.id,
        testCaseId: t.id,
        judge0Token: tokens[i],
      })),
    });

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let results: Judge0Result[] = [];
    for (let delay = 300; ; delay = Math.min(delay * 1.5, 2000)) {
      results = await getBatch(tokens);
      if (results.every((r) => isFinished(r.statusId))) break;
      if (Date.now() > deadline) throw new Error("Judge0 did not finish in time");
      await sleep(delay);
    }

    let verdict: SubmissionStatus = "Accepted";
    let passedCount = 0;
    let maxTimeMs = 0;
    let maxMemKb = 0;
    let compilerOutput: string | null = null;

    for (let i = 0; i < tests.length; i++) {
      const r = results[i];
      const passed = r.statusId === 3 && check(problem.checkerType, r.stdout, tests[i].expectedOutput);
      const status = mapStatus(r, passed);
      if (status === "Accepted") passedCount++;
      else if (verdict === "Accepted") verdict = status;
      if (status === "CompilationError" && !compilerOutput) compilerOutput = r.compileOutput.slice(0, 8000);
      const timeMs = r.timeSec === null ? null : Math.round(r.timeSec * 1000);
      maxTimeMs = Math.max(maxTimeMs, timeMs ?? 0);
      maxMemKb = Math.max(maxMemKb, r.memoryKb ?? 0);
      await prisma.submissionTestResult.update({
        where: { submissionId_testCaseId: { submissionId: sub.id, testCaseId: tests[i].id } },
        data: { status, timeMs, memoryKb: r.memoryKb },
      });
    }

    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        status: verdict,
        passedCount,
        executionTimeMs: maxTimeMs,
        memoryUsedKb: maxMemKb,
        compilerOutput,
        completedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`judging ${sub.id} failed:`, (err as Error).message);
    await prisma.submission.update({
      where: { id: sub.id },
      data: { status: "InternalError", completedAt: new Date() },
    });
  }
}
