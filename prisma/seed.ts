import { PrismaClient, type TestCaseCategory } from "@prisma/client";

const prisma = new PrismaClient();

// Deterministic PRNG so the test set is reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Reference solution, used to compute expected outputs.
function solve(target: number, nums: number[]): string {
  const seen = new Map<number, number>();
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return `${j} ${i}`;
    if (!seen.has(nums[i])) seen.set(nums[i], i);
  }
  throw new Error("no pair");
}

// Builds a case with exactly one valid pair: every filler is 1 mod 4 and the two
// pair values are 0 mod 4, so filler+filler and filler+pair can never equal target.
function build(n: number, rand: () => number, maxAbs: number, pair?: [number, number], at?: [number, number]) {
  const k = Math.floor(maxAbs / 4);
  const filler = () => 4 * (Math.floor(rand() * (2 * k - 1)) - (k - 1)) + 1;
  const quad = () => 4 * (Math.floor(rand() * (2 * k + 1)) - k);
  const [a, b] = pair ?? [quad(), quad()];
  const nums = Array.from({ length: n }, filler);
  let [i, j] = at ?? [Math.floor(rand() * n), Math.floor(rand() * n)];
  while (j === i) j = Math.floor(rand() * n);
  nums[i] = a;
  nums[j] = b;
  return { target: a + b, nums };
}

const fmt = (target: number, nums: number[]) => `${nums.length} ${target}\n${nums.join(" ")}\n`;

async function main() {
  const langs = [
    { name: "C++17", judge0LanguageId: 54, compilerArgs: "-std=c++17 -O2", isEnabled: true },
    { name: "Python 3", judge0LanguageId: 71, compilerArgs: null, isEnabled: true },
    // Planned for later. Rows exist so enabling one is a data change, not a code change.
    { name: "C#", judge0LanguageId: 51, compilerArgs: null, isEnabled: false },
    { name: "Java", judge0LanguageId: 62, compilerArgs: null, isEnabled: false },
    { name: "JavaScript", judge0LanguageId: 63, compilerArgs: null, isEnabled: false },
  ];
  for (const l of langs) {
    await prisma.language.upsert({ where: { name: l.name }, update: l, create: l });
  }
  const cpp = await prisma.language.findUniqueOrThrow({ where: { name: "C++17" } });
  const py = await prisma.language.findUniqueOrThrow({ where: { name: "Python 3" } });

  const rand = rng(20261014);
  const cases: { input: string; category: TestCaseCategory; isSample?: boolean }[] = [];
  const add = (target: number, nums: number[], category: TestCaseCategory, isSample = false) =>
    cases.push({ input: fmt(target, nums), category, isSample });

  add(9, [2, 7, 11, 15], "Sample", true);
  add(6, [3, 2, 4], "Sample", true);
  add(6, [3, 3], "Edge"); // minimum n, duplicate values
  add(-8, [-3, 5, -5, 9], "Edge"); // negatives
  add(0, [0, 7, 0], "Edge"); // zeros
  add(2_000_000_000, [1_000_000_000, -999_999_999, 1_000_000_000], "Overflow"); // target - x leaves 32-bit range
  {
    const c = build(10, rand, 100);
    add(c.target, c.nums, "Random");
  }
  {
    const c = build(1_000, rand, 1_000_000_000);
    add(c.target, c.nums, "Random");
  }
  {
    const c = build(200_000, rand, 1_000_000_000);
    add(c.target, c.nums, "Stress");
  }
  {
    // Pair sits at the very end, so an O(n^2) scan does the maximum work.
    const n = 200_000;
    const c = build(n, rand, 1_000_000_000, undefined, [n - 2, n - 1]);
    add(c.target, c.nums, "AntiNaive");
  }

  const problem = await prisma.problem.upsert({
    where: { slug: "pair-with-a-target-sum" },
    update: {},
    create: {
      slug: "pair-with-a-target-sum",
      title: "Pair with a Target Sum",
      statementMarkdown:
        "You are given a list of integers and a target value. Find two different positions whose values add up to the target and print them in increasing order. Exactly one such pair exists.",
      inputDescription:
        "The first line has n and the target (2 ≤ n ≤ 2·10^5, |target| ≤ 2·10^9). The second line has n integers a_i (|a_i| ≤ 10^9).",
      outputDescription: "Two positions, 0-indexed, separated by a space, smaller first.",
      difficultyLevel: "Easy",
      difficultyRating: 900,
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      checkerType: "TokenCompare",
      status: "Published",
      publishedAt: new Date(),
    },
  });

  await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
  await prisma.testCase.createMany({
    data: cases.map((c, i) => {
      const [first, second] = c.input.split("\n");
      const target = Number(first.split(" ")[1]);
      const nums = second.split(" ").map(Number);
      return {
        problemId: problem.id,
        input: c.input,
        expectedOutput: solve(target, nums),
        isSample: c.isSample ?? false,
        sequence: i + 1,
        category: c.category,
      };
    }),
  });

  const starters: Record<number, string> = {
    [cpp.id]: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    long long target;
    cin >> n >> target;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    // print the two positions here
}
`,
    [py.id]: `n, target = map(int, input().split())
a = list(map(int, input().split()))
# print the two positions here
`,
  };
  for (const [languageId, starterCode] of Object.entries(starters)) {
    await prisma.problemLanguage.upsert({
      where: { problemId_languageId: { problemId: problem.id, languageId: Number(languageId) } },
      update: { starterCode },
      create: { problemId: problem.id, languageId: Number(languageId), starterCode },
    });
  }

  console.log(`Seeded ${langs.length} languages and "${problem.title}" with ${cases.length} tests.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
