# bitrung;

Climb the ladder, one bit at a time. A competitive programming practice site with original problems, five difficulty levels, in-browser submissions and automatic judging.

## What works

- **Accounts:** sign up, sign in and sign out with email and password. Passwords are hashed with scrypt; sessions are random tokens in an httpOnly cookie, stored only as a SHA-256 hash.
- **Catalogue** (`/problems`): search by title or topic, filter by level and by your status (Solved, Attempted, Unsolved), paginated, server-rendered.
- **Workspace** (`/problems/:slug`): statement and samples, per-problem starter templates, code remembered in the browser, Run samples, Submit, a verdict with time, memory and pass or fail per test, and bookmarks.
- **Judging** by a self-hosted Judge0: Accepted, Wrong Answer, Compilation Error, Runtime Error and Time Limit Exceeded. C++17 and Python 3 are enabled; C#, Java and JavaScript exist as disabled rows in `languages`.
- **Limits:** 20 submissions and 60 sample runs per user per UTC day, one run at a time per user, and same-origin checks on every write. A run lost mid-judge is marked as a judge error after 2 minutes, so it can't block anyone.
- **Progress:** a problem is Solved only when the server sees an Accepted submission; Attempted means submitted but not yet solved.
- The screens follow the Playful designs (home, catalogue, workspace). Sign-in and sign-up use the same style.

One problem is published so far, *Pair with a Target Sum*, with 25 hidden tests. The seed checks every test against the statement's promise (exactly one valid pair) before writing it.

Not built yet: the progress page, admin review, problem authoring, and deployment.

## Run it locally

Needs Docker and Node 20+.

```bash
docker compose -f infra/docker-compose.yml up -d   # app Postgres on :5433, Judge0 on :2358
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
npm run build && npm start                          # http://localhost:3000
```

The Judge0 image is large (about 3 GB to download) and its first start takes a minute or so.

## Tests

```bash
npm test            # unit tests: output checker, password hashing
npm run test:e2e    # Playwright; needs the app, its database and Judge0 running
```

The end-to-end suite drives a real browser and the API. It covers browsing as a visitor, signing up, out and in, two correct solutions and ten known wrong ones (each must get the right verdict), users not seeing each other's submissions, the limits, the full write-submit-verdict journey in the editor, phone-width layout, and that no hidden test data ever reaches the browser. Set `SCREENSHOT_DIR` to also save screenshots.

## How judging works

1. `POST /api/submissions` checks the session, validates the input with Zod, checks the language is enabled for the problem and the user's limits, stores the submission as `Queued` and starts judging. It returns the submission id straight away.
2. `src/lib/judge.ts` sends one Judge0 submission per test case, in batches of up to 20 (Judge0's limit), then polls until every test is finished.
3. Output is compared on our side (`src/lib/checker.ts`), not by Judge0, so expected outputs never go to the judge. The overall verdict is the first failing test's verdict.
4. The browser polls `GET /api/submissions/:id`, which returns verdict data only, and only to the submission's owner.

Everything sent to and from Judge0 is base64-encoded, because compiler output can contain bytes that are not valid UTF-8.

Judging currently runs inside the web server process, which is fine for `next dev` and `next start` but not for serverless hosting. Production needs a durable queue or Judge0 callbacks.
