import "server-only";
import { prisma } from "./prisma";

export async function setBookmark(userId: string, problemSlug: string, bookmarked: boolean) {
  const problem = await prisma.problem.findFirst({ where: { slug: problemSlug, status: "Published" }, select: { id: true } });
  if (!problem) return false;
  await prisma.userProblemProgress.upsert({
    where: { userId_problemId: { userId, problemId: problem.id } },
    update: { isBookmarked: bookmarked },
    create: { userId, problemId: problem.id, isBookmarked: bookmarked },
  });
  return true;
}

export async function markAttempted(userId: string, problemId: number) {
  const now = new Date();
  await prisma.userProblemProgress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { lastAttemptedAt: now },
    create: { userId, problemId, lastAttemptedAt: now },
  });
}

// Only the judge calls this, and only for an Accepted real submission.
export async function markSolved(userId: string, problemId: number) {
  const now = new Date();
  await prisma.userProblemProgress.upsert({
    where: { userId_problemId: { userId, problemId } },
    update: { isSolved: true },
    create: { userId, problemId, isSolved: true, firstSolvedAt: now, lastAttemptedAt: now },
  });
  await prisma.userProblemProgress.updateMany({
    where: { userId, problemId, firstSolvedAt: null },
    data: { firstSolvedAt: now },
  });
}
