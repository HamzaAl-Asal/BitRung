import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { CORRECT_CPP, CORRECT_PY, WRONG } from "./solutions";

try {
  process.loadEnvFile(".env");
} catch {}

const SLUG = "pair-with-a-target-sum";
const PROBLEM = "/problems/" + SLUG;
const PASSWORD = "climb-the-ladder-42";
const run = Date.now().toString(36);
const userA = { name: "Ada", email: `ada-${run}@example.test` };
const userB = { name: "Brook", email: `brook-${run}@example.test` };
const shots = process.env.SCREENSHOT_DIR;

const prisma = new PrismaClient();
test.afterAll(() => prisma.$disconnect());

type Dto = { id: string; kind: string; status: string; passedCount: number; totalCount: number; executionTimeMs: number | null };

let languageIds: Record<string, number> = {};
let pageA: Page;
let pageB: Page;
let acceptedId = "";

async function signUp(browser: Browser, u: { name: string; email: string }) {
  const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Display name").fill(u.name);
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/problems$/);
  await expect(page.getByRole("navigation", { name: "Main" })).toContainText(u.name);
  return page;
}

async function judge(request: APIRequestContext, lang: string, sourceCode: string, kind = "Submit"): Promise<Dto> {
  const res = await request.post("/api/submissions", {
    data: { problemSlug: SLUG, languageId: languageIds[lang], sourceCode, kind },
  });
  expect(res.status(), await res.text()).toBe(202);
  const { id } = await res.json();
  for (;;) {
    const dto: Dto = await (await request.get(`/api/submissions/${id}`)).json();
    if (dto.status !== "Queued" && dto.status !== "Processing") return dto;
    await new Promise((r) => setTimeout(r, 400));
  }
}

test.describe.serial("bitrung", () => {
  test("a visitor can browse problems but not submit", async ({ page, request }) => {
    const detail = await (await request.get(`/api/problems/${SLUG}`)).json();
    languageIds = Object.fromEntries(detail.languages.map((l: { id: number; name: string }) => [l.name, l.id]));
    expect(Object.keys(languageIds)).toEqual(["C++17", "Python 3"]);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Climb. Solve. Level up.");
    await expect(page.getByText("C++17 and Python 3 supported")).toBeVisible();
    if (shots) await page.screenshot({ path: `${shots}/home.png`, fullPage: true });

    await page.getByRole("link", { name: "Start climbing" }).click();
    await expect(page.getByRole("link", { name: /Pair with a Target Sum/ })).toBeVisible();
    await page.getByRole("navigation", { name: "Filter by level" }).getByRole("link", { name: "Medium" }).click();
    await expect(page.getByText("Nothing on this rung yet")).toBeVisible();
    await page.goto("/problems?q=hash");
    await expect(page.getByRole("link", { name: /Pair with a Target Sum/ })).toBeVisible();

    await page.goto(PROBLEM);
    await expect(page.getByRole("link", { name: "Sign in to submit" }).first()).toBeVisible();
    const res = await request.post("/api/submissions", {
      data: { problemSlug: SLUG, languageId: languageIds["C++17"], sourceCode: CORRECT_CPP },
    });
    expect(res.status()).toBe(401);
  });

  test("every page fits a phone screen without sideways scrolling", async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })).newPage();
    for (const path of ["/", "/problems", PROBLEM, "/sign-in", "/sign-up"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
    if (shots) await page.goto(PROBLEM).then(() => page.screenshot({ path: `${shots}/workspace-phone.png`, fullPage: true }));
  });

  test("hidden test data never reaches the browser", async ({ request }) => {
    const hidden = await prisma.testCase.findMany({
      where: { problem: { slug: SLUG }, isSample: false },
      select: { input: true },
    });
    const needles = hidden.map((t) => t.input.slice(0, 40)).filter((s) => s.length >= 20);
    expect(needles.length).toBeGreaterThan(10);
    const bodies = [
      await (await request.get(PROBLEM)).text(),
      await (await request.get(`/api/problems/${SLUG}`)).text(),
      await (await request.get("/api/problems")).text(),
    ];
    for (const body of bodies) for (const n of needles) expect(body.includes(n), `leaked: ${n}`).toBe(false);
  });

  test("sign up, sign out and sign in", async ({ browser }) => {
    pageA = await signUp(browser, userA);
    if (shots) await pageA.screenshot({ path: `${shots}/catalogue.png`, fullPage: true });

    const dup = await (await browser.newContext()).newPage();
    await dup.goto("/sign-up");
    await dup.getByLabel("Display name").fill("Someone");
    await dup.getByLabel("Email").fill(userA.email.toUpperCase());
    await dup.getByLabel("Password").fill(PASSWORD);
    await dup.getByRole("button", { name: "Create account" }).click();
    await expect(dup.locator("form [role=alert]")).toContainText("already has an account");

    await pageA.getByRole("button", { name: "Sign out" }).click();
    await expect(pageA.getByRole("link", { name: "Sign in" })).toBeVisible();

    await pageA.goto(`/sign-in?next=${encodeURIComponent(PROBLEM)}`);
    await pageA.getByLabel("Email").fill(userA.email);
    await pageA.getByLabel("Password").fill("wrong-password");
    await pageA.getByRole("button", { name: "Sign in" }).click();
    await expect(pageA.locator("form [role=alert]")).toContainText("don't match");
    await pageA.getByLabel("Password").fill(PASSWORD);
    await pageA.getByRole("button", { name: "Sign in" }).click();
    await expect(pageA).toHaveURL(new RegExp(`${PROBLEM}$`));
    await expect(pageA.getByText(/0 of 20 submissions today/)).toBeVisible();
  });

  test("correct solutions are accepted and the problem shows as solved", async () => {
    for (const [lang, src] of [["C++17", CORRECT_CPP], ["Python 3", CORRECT_PY]] as const) {
      const dto = await judge(pageA.request, lang, src);
      expect(dto.status, lang).toBe("Accepted");
      expect(dto.passedCount).toBe(25);
      expect(dto.totalCount).toBe(25);
      acceptedId = dto.id;
    }
    await pageA.goto("/problems");
    await expect(pageA.getByRole("link", { name: /Pair with a Target Sum/ })).toContainText("Solved");
  });

  test("every known wrong solution is caught", async () => {
    for (const w of WRONG) {
      if (w.passesSamples) {
        const sample = await judge(pageA.request, w.lang, w.source, "SampleRun");
        expect(sample.status, `${w.name} on samples`).toBe("Accepted");
        expect(sample.totalCount).toBe(2);
      }
      const dto = await judge(pageA.request, w.lang, w.source);
      console.log(`  ${w.name.padEnd(40)} ${dto.status.padEnd(18)} ${dto.passedCount}/${dto.totalCount}`);
      expect(dto.status, w.name).toBe(w.expect);
    }
  });

  test("users can't see each other's submissions", async ({ browser, request }) => {
    pageB = await signUp(browser, userB);
    expect((await pageB.request.get(`/api/submissions/${acceptedId}`)).status()).toBe(404);
    expect((await request.get(`/api/submissions/${acceptedId}`)).status()).toBe(401);
    expect((await pageA.request.get(`/api/submissions/${acceptedId}`)).status()).toBe(200);
    // Bookmarking alone is not an attempt.
    const bm = await pageB.request.put(`/api/me/problems/${SLUG}/bookmark`, { data: { bookmarked: true } });
    expect(bm.status()).toBe(200);
    await pageB.goto("/problems");
    await expect(pageB.getByRole("link", { name: /Pair with a Target Sum/ })).toContainText("Unsolved");
    await pageB.goto("/problems?status=Attempted");
    await expect(pageB.getByText("Nothing on this rung yet")).toBeVisible();
  });

  test("limits: one run at a time, same origin only, daily quota", async () => {
    const body = { problemSlug: SLUG, languageId: languageIds["C++17"], sourceCode: CORRECT_CPP };
    const first = await pageA.request.post("/api/submissions", { data: body });
    expect(first.status()).toBe(202);
    const second = await pageA.request.post("/api/submissions", { data: body });
    expect(second.status()).toBe(409);
    const { id } = await first.json();
    await expect
      .poll(async () => (await (await pageA.request.get(`/api/submissions/${id}`)).json()).status, { timeout: 60_000 })
      .toBe("Accepted");

    // A run lost mid-judge (say the server restarted) must not lock the user out.
    const ada = await prisma.user.findUniqueOrThrow({ where: { email: userA.email } });
    const stale = await prisma.submission.create({
      data: {
        userId: ada.id,
        problemId: (await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG } })).id,
        languageId: languageIds["C++17"],
        sourceCode: "// lost run",
        status: "Processing",
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
    const afterStale = await pageA.request.post("/api/submissions", { data: body });
    expect(afterStale.status()).toBe(202);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("InternalError");
    const { id: id2 } = await afterStale.json();
    await expect
      .poll(async () => (await (await pageA.request.get(`/api/submissions/${id2}`)).json()).status, { timeout: 60_000 })
      .toBe("Accepted");

    const foreign = await pageA.request.post("/api/submissions", { data: body, headers: { Origin: "https://evil.example" } });
    expect(foreign.status()).toBe(403);

    // Fill Brook's quota directly, then the next submit must be refused.
    const brook = await prisma.user.findUniqueOrThrow({ where: { email: userB.email } });
    const problem = await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG } });
    await prisma.submission.createMany({
      data: Array.from({ length: 20 }, () => ({
        userId: brook.id,
        problemId: problem.id,
        languageId: languageIds["C++17"],
        sourceCode: "// filler",
        status: "WrongAnswer" as const,
      })),
    });
    const over = await pageB.request.post("/api/submissions", { data: body });
    expect(over.status()).toBe(429);
    expect((await over.json()).error).toContain("Daily limit of 20 submissions");
  });

  test("in the browser: write code, submit, see the verdict", async () => {
    const page = pageA;
    await page.goto(PROBLEM);
    await page.getByLabel("Language").selectOption({ label: "Python 3" });
    const editor = page.getByLabel("Code", { exact: true });
    await expect(editor).toHaveValue(/print the two positions here/); // starter template
    await editor.fill(CORRECT_PY);
    const quota = page.getByText(/of 20 submissions today/);
    const before = Number((await quota.textContent())!.split(" ")[0]);

    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(page.getByText("Accepted!")).toBeVisible();
    await expect(page.getByText("25 / 25 tests")).toBeVisible();
    await expect(quota).toHaveText(`${before + 1} of 20 submissions today`);
    if (shots) await page.screenshot({ path: `${shots}/workspace-accepted.png`, fullPage: true });

    await page.getByRole("button", { name: "Run samples" }).click();
    await expect(page.getByText("Samples passed")).toBeVisible();
    await expect(quota).toHaveText(`${before + 1} of 20 submissions today`); // sample runs don't count

    await page.reload();
    await expect(page.getByLabel("Code", { exact: true })).toHaveValue(CORRECT_PY); // remembered
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Reset to template" }).click();
    await expect(page.getByLabel("Code", { exact: true })).toHaveValue(/print the two positions here/);

    await page.getByRole("button", { name: "Bookmark" }).click();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Bookmarked" })).toHaveAttribute("aria-pressed", "true");
  });
});
