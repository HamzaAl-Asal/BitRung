import "server-only";
import { z } from "zod";
import type { DifficultyLevel, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
  { value: "VeryHard", label: "Very Hard" },
  { value: "Master", label: "Master" },
];
export const levelLabel = (l: DifficultyLevel) => LEVELS.find((x) => x.value === l)!.label;

export type ProgressStatus = "Solved" | "Attempted" | "Unsolved";

const progressStatus = (p?: { isSolved: boolean; lastAttemptedAt: Date | null }): ProgressStatus =>
  p?.isSolved ? "Solved" : p?.lastAttemptedAt ? "Attempted" : "Unsolved";
export const PAGE_SIZE = 20;

export const catalogueQuery = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  level: z.enum(["Easy", "Medium", "Hard", "VeryHard", "Master"]).optional().catch(undefined),
  status: z.enum(["Solved", "Attempted", "Unsolved"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type CatalogueQuery = z.infer<typeof catalogueQuery>;

// Public fields only. Never selects tests, reference solutions or anything server-only.
export async function listProblems(query: CatalogueQuery, userId: string | null) {
  const where: Prisma.ProblemWhereInput = { status: "Published" };
  if (query.level) where.difficultyLevel = query.level;
  if (query.q) {
    where.OR = [
      { title: { contains: query.q, mode: "insensitive" } },
      { tags: { some: { tag: { name: { contains: query.q, mode: "insensitive" } } } } },
    ];
  }
  // Status filters only mean something for a signed-in user.
  // A progress row can exist just for a bookmark, so "attempted" means lastAttemptedAt is set.
  const attempted = { isSolved: false, lastAttemptedAt: { not: null } };
  if (userId && query.status === "Solved") where.progress = { some: { userId, isSolved: true } };
  if (userId && query.status === "Attempted") where.progress = { some: { userId, ...attempted } };
  if (userId && query.status === "Unsolved") {
    where.progress = { none: { userId, OR: [{ isSolved: true }, { lastAttemptedAt: { not: null } }] } };
  }

  const [total, rows] = await Promise.all([
    prisma.problem.count({ where }),
    prisma.problem.findMany({
      where,
      orderBy: [{ difficultyRating: "asc" }, { id: "asc" }],
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        difficultyLevel: true,
        difficultyRating: true,
        tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
        progress: userId ? { where: { userId }, select: { isSolved: true, lastAttemptedAt: true } } : false,
      },
    }),
  ]);

  return {
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    problems: rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      level: p.difficultyLevel,
      rating: p.difficultyRating,
      tags: p.tags.map((t) => t.tag.name),
      status: !userId ? null : progressStatus(p.progress?.[0]),
    })),
  };
}

export async function getProblemDetail(slug: string, userId: string | null) {
  const p = await prisma.problem.findFirst({
    where: { slug, status: "Published" },
    select: {
      id: true,
      slug: true,
      title: true,
      statementMarkdown: true,
      inputDescription: true,
      outputDescription: true,
      difficultyLevel: true,
      difficultyRating: true,
      timeLimitMs: true,
      memoryLimitMb: true,
      tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
      // Samples only. Hidden tests are filtered out here, on the server.
      testCases: { where: { isSample: true }, orderBy: { sequence: "asc" }, select: { input: true, expectedOutput: true } },
      languages: {
        where: { language: { isEnabled: true } },
        orderBy: { languageId: "asc" },
        select: { starterCode: true, language: { select: { id: true, name: true } } },
      },
      progress: userId ? { where: { userId }, select: { isSolved: true, isBookmarked: true } } : false,
    },
  });
  if (!p) return null;
  const mine = p.progress?.[0];
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    statement: p.statementMarkdown,
    input: p.inputDescription,
    output: p.outputDescription,
    level: p.difficultyLevel,
    rating: p.difficultyRating,
    timeLimitMs: p.timeLimitMs,
    memoryLimitMb: p.memoryLimitMb,
    tags: p.tags.map((t) => t.tag.name),
    samples: p.testCases,
    languages: p.languages.map((l) => ({ id: l.language.id, name: l.language.name, starter: l.starterCode })),
    isSolved: mine?.isSolved ?? false,
    isBookmarked: mine?.isBookmarked ?? false,
  };
}

export async function featuredProblems(take: number) {
  const rows = await prisma.problem.findMany({
    where: { status: "Published" },
    orderBy: [{ difficultyRating: "asc" }, { id: "asc" }],
    take,
    select: {
      slug: true,
      title: true,
      difficultyLevel: true,
      tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
    },
  });
  return rows.map((p) => ({ slug: p.slug, title: p.title, level: p.difficultyLevel, tags: p.tags.map((t) => t.tag.name) }));
}

export async function enabledLanguageNames() {
  const rows = await prisma.language.findMany({ where: { isEnabled: true }, orderBy: { id: "asc" }, select: { name: true } });
  return rows.map((r) => r.name);
}

export async function listTags() {
  return prisma.tag.findMany({
    where: { problems: { some: { problem: { status: "Published" } } } },
    orderBy: { name: "asc" },
    select: { name: true },
  });
}
