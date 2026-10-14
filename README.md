# bitrung;

Climb the ladder, one bit at a time. A competitive programming practice site with original problems, five difficulty levels, in-browser submissions and automatic judging.

## Status: walking skeleton

This is the first milestone: one problem, submit code in the browser, get a real verdict from a self-hosted Judge0. It is deliberately unstyled. The real screens follow the Playful designs once the judging loop is settled.

What works end to end:

- One published problem, *Pair with a Target Sum*, with 10 tests: samples, edge, overflow, random, stress (n = 200,000) and anti-naive.
- C++17 and Python 3. C#, Java and JavaScript exist as disabled rows in `languages`.
- Verdicts: Accepted, Wrong Answer, Compilation Error, Runtime Error, Time Limit Exceeded, with max time and memory per submission and pass/fail per test.
- Hidden tests and expected outputs never leave the server (checked by the end-to-end suite).

Not in this milestone: accounts (a fixed dev user stands in), catalogue and search, progress, admin, styling, deployment.

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
npm test            # unit tests (output checker)
npm run test:e2e    # needs the app, its database and Judge0 running
```

`test:e2e` submits seven known solutions through the API (two correct, one wrong, one that does not compile, one that crashes, two that are too slow) and fails if any verdict is off or any hidden test data shows up in a response.

## How judging works

1. `POST /api/submissions` validates the input with Zod, checks the language is enabled for the problem, stores the submission as `Queued` and starts judging. It returns the submission id straight away.
2. `src/lib/judge.ts` sends one Judge0 submission per test case as a single batch, then polls Judge0 until every test is finished.
3. Output is compared on our side (`src/lib/checker.ts`), not by Judge0, so expected outputs never go to the judge. The overall verdict is the first failing test's verdict.
4. The browser polls `GET /api/submissions/:id`, which returns verdict data only.

Everything sent to and from Judge0 is base64-encoded, because compiler output can contain bytes that are not valid UTF-8.

Judging currently runs inside the web server process, which is fine for `next dev` and `next start` but not for serverless hosting. Production needs a durable queue or Judge0 callbacks.
