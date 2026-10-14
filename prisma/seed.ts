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

// Counts pairs i < j with a[i] + a[j] == target. The statement promises exactly one;
// the seed refuses to write a test that breaks that promise.
function countPairs(target: number, nums: number[]): number {
  const seen = new Map<number, number>();
  let pairs = 0;
  for (const x of nums) {
    pairs += seen.get(target - x) ?? 0;
    seen.set(x, (seen.get(x) ?? 0) + 1);
  }
  return pairs;
}

const mod = (x: number, m: number) => ((x % m) + m) % m;

// Builds a case with exactly one valid pair: every filler is 1 mod 4 and the two
// pair values are 0 mod 4, so filler+filler and filler+pair can never equal target.
// With `trap`, target/2 is also planted on its own, which catches solutions that
// pair an element with itself.
function build(
  n: number,
  rand: () => number,
  maxAbs: number,
  opts: { at?: [number, number]; trap?: boolean; filler?: () => number } = {},
) {
  const k = Math.floor(maxAbs / 4);
  const filler = opts.filler ?? (() => 4 * (Math.floor(rand() * (2 * k - 1)) - (k - 1)) + 1);
  const quad = () => 4 * (Math.floor(rand() * (2 * k + 1)) - k);
  let a = quad();
  let b = quad();
  // A trap value target/2 must be 2 mod 4, so it can't pair with anything either.
  while (opts.trap && mod(a + b, 8) !== 4) b = quad();
  const nums = Array.from({ length: n }, filler);
  const free = () => Math.floor(rand() * n);
  let [i, j] = opts.at ?? [free(), free()];
  while (j === i) j = free();
  nums[i] = a;
  nums[j] = b;
  if (opts.trap) {
    let t = free();
    while (t === i || t === j) t = free();
    nums[t] = (a + b) / 2;
  }
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
  const cases: { target: number; nums: number[]; category: TestCaseCategory; isSample?: boolean }[] = [];
  const add = (target: number, nums: number[], category: TestCaseCategory, isSample = false) =>
    cases.push({ target, nums, category, isSample });
  const gen = (n: number, maxAbs: number, category: TestCaseCategory, opts?: Parameters<typeof build>[3]) => {
    const c = build(n, rand, maxAbs, opts);
    add(c.target, c.nums, category);
  };

  // Samples
  add(9, [2, 7, 11, 15], "Sample", true);
  add(6, [3, 2, 4], "Sample", true); // 3 + 3 would be wrong: same position twice

  // Edge cases
  add(6, [3, 3], "Edge"); // minimum n, the pair is two equal values
  add(-8, [-3, 5, -5, 9], "Edge"); // negatives
  add(0, [0, 7, 0], "Edge"); // zeros
  add(0, [-4, 9, 4], "Edge"); // target 0 from opposite signs
  add(10, [5, 1, 9, 2], "Edge"); // 5 + 5 is the trap, 1 + 9 is the answer
  add(2_000_000_000, [1_000_000_000, -999_999_999, 1_000_000_000], "Overflow"); // largest target
  add(-2_000_000_000, [-1_000_000_000, 999_999_999, -1_000_000_000], "Overflow"); // smallest target
  {
    // All fillers equal, pair at the two ends
    const c = build(1_000, rand, 1_000_000, { at: [0, 999], filler: () => 13 });
    add(c.target, c.nums, "Edge");
  }
  {
    // Sorted ascending, then descending: catches answers given as sorted positions
    const c = build(50, rand, 1_000);
    const asc = [...c.nums].sort((x, y) => x - y);
    add(c.target, asc, "Edge");
    add(c.target, [...asc].reverse(), "Edge");
  }

  // Self-pair traps, and pairs far apart (catches adjacent-only checks)
  gen(8, 100, "AntiNaive", { trap: true });
  gen(40, 1_000, "AntiNaive", { trap: true });
  gen(2_000, 1_000_000_000, "AntiNaive", { trap: true, at: [0, 1_999] });

  // Random: many small, a few medium
  for (let i = 0; i < 6; i++) gen(2 + Math.floor(rand() * 9), 50, "Random");
  gen(500, 1_000_000_000, "Random");
  gen(5_000, 1_000_000_000, "Random", { trap: true });

  // Stress: maximum size. The last one puts the pair at the very end, so an O(n^2) scan does maximum work.
  gen(200_000, 1_000_000_000, "Stress");
  gen(200_000, 1_000_000_000, "Stress", { at: [199_998, 199_999] });

  for (const [i, c] of cases.entries()) {
    const pairs = countPairs(c.target, c.nums);
    if (pairs !== 1) throw new Error(`Test ${i + 1} has ${pairs} valid pairs; the statement promises exactly one`);
    if (c.nums.length < 2 || c.nums.length > 200_000) throw new Error(`Test ${i + 1}: n out of range`);
    if (c.nums.some((x) => Math.abs(x) > 1_000_000_000) || Math.abs(c.target) > 2_000_000_000) {
      throw new Error(`Test ${i + 1}: value out of range`);
    }
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

  // Replacing tests would orphan judged results, so only (re)write them while nobody has submitted.
  const judged = await prisma.submissionTestResult.count({ where: { testCase: { problemId: problem.id } } });
  if (judged === 0) {
    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    await prisma.testCase.createMany({
      data: cases.map((c, i) => ({
        problemId: problem.id,
        input: fmt(c.target, c.nums),
        expectedOutput: solve(c.target, c.nums),
        isSample: c.isSample ?? false,
        sequence: i + 1,
        category: c.category,
      })),
    });
  } else {
    console.log("Tests already judged against; leaving them as they are.");
  }

  for (const name of ["Arrays", "Hash map"]) {
    const tag = await prisma.tag.upsert({ where: { name }, update: {}, create: { name } });
    await prisma.problemTag.upsert({
      where: { problemId_tagId: { problemId: problem.id, tagId: tag.id } },
      update: {},
      create: { problemId: problem.id, tagId: tag.id },
    });
  }

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
