// End-to-end: submits known solutions through the running app's API and checks
// each verdict, then checks hidden test data never reaches the client.
// Needs the app (APP_URL, default http://localhost:3000), its DB and Judge0 running.

const APP = process.env.APP_URL ?? "http://localhost:3000";
const SLUG = "pair-with-a-target-sum";

const CPP = 1; // language ids as seeded: 1 = C++17, 2 = Python 3
const PY = 2;

const cases: { name: string; languageId: number; expect: string; source: string }[] = [
  {
    name: "C++ hash map",
    languageId: CPP,
    expect: "Accepted",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){ios::sync_with_stdio(false);cin.tie(nullptr);
int n; long long t; cin>>n>>t; unordered_map<long long,int> s; s.reserve(n*2);
for(int i=0;i<n;i++){long long x;cin>>x;auto it=s.find(t-x);
if(it!=s.end()){cout<<it->second<<" "<<i<<"\\n";return 0;} s.emplace(x,i);} }`,
  },
  {
    name: "Python dict",
    languageId: PY,
    expect: "Accepted",
    source: `import sys
data = sys.stdin.buffer.read().split()
n, t = int(data[0]), int(data[1])
seen = {}
for i in range(n):
    x = int(data[2 + i])
    j = seen.get(t - x)
    if j is not None:
        print(j, i)
        break
    seen.setdefault(x, i)`,
  },
  {
    name: "C++ always prints 0 1",
    languageId: CPP,
    expect: "WrongAnswer",
    source: `#include <cstdio>
int main(){ std::puts("0 1"); }`,
  },
  {
    name: "C++ syntax error",
    languageId: CPP,
    expect: "CompilationError",
    source: `int main() { this is not c++ }`,
  },
  {
    name: "C++ null dereference",
    languageId: CPP,
    expect: "RuntimeError",
    source: `#include <cstdio>
int main(){ volatile int *p = nullptr; *p = 1; std::puts("0 1"); }`,
  },
  {
    name: "C++ O(n^2) pair scan",
    languageId: CPP,
    expect: "TimeLimitExceeded",
    source: `#include <bits/stdc++.h>
using namespace std;
int main(){int n; long long t; cin>>n>>t; vector<long long>a(n); for(auto&x:a)cin>>x;
for(int i=0;i<n;i++)for(int j=i+1;j<n;j++)if(a[i]+a[j]==t){cout<<i<<" "<<j<<"\\n";return 0;}}`,
  },
  {
    name: "Python O(n^2) pair scan",
    languageId: PY,
    expect: "TimeLimitExceeded",
    source: `n, t = map(int, input().split())
a = list(map(int, input().split()))
for i in range(n):
    for j in range(i + 1, n):
        if a[i] + a[j] == t:
            print(i, j)
            raise SystemExit`,
  },
];

type Dto = {
  status: string;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  tests: { n: number; status: string }[];
};

async function run(languageId: number, source: string): Promise<{ dto: Dto; raw: string; wallMs: number }> {
  const started = Date.now();
  const res = await fetch(`${APP}/api/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problemSlug: SLUG, languageId, sourceCode: source }),
  });
  if (res.status !== 202) throw new Error(`POST returned ${res.status}: ${await res.text()}`);
  const { id } = (await res.json()) as { id: string };
  for (;;) {
    const r = await fetch(`${APP}/api/submissions/${id}`);
    const raw = await r.text();
    const dto = JSON.parse(raw) as Dto;
    if (dto.status !== "Queued" && dto.status !== "Processing") return { dto, raw, wallMs: Date.now() - started };
    await new Promise((s) => setTimeout(s, 500));
  }
}

async function main() {
  let failures = 0;
  const rawBodies: string[] = [];
  for (const c of cases) {
    const { dto, raw, wallMs } = await run(c.languageId, c.source);
    rawBodies.push(raw);
    const ok = dto.status === c.expect;
    if (!ok) failures++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(26)} expected ${c.expect.padEnd(18)} got ${dto.status.padEnd(18)}` +
        ` ${dto.passedCount}/${dto.totalCount} tests, ${dto.executionTimeMs ?? "-"} ms max, ` +
        `${dto.memoryUsedKb ?? "-"} KB max, ${wallMs} ms wall`,
    );
  }

  // Hidden data must never reach the client: not in API responses, not in the problem page.
  const page = await (await fetch(`${APP}/problems/${SLUG}`)).text();
  const leaks = ["199998 199999", "51555 198756", "1000000000 -999999999", "expectedOutput\":\"0 2"];
  for (const needle of leaks) {
    for (const [where, body] of [["problem page", page], ...rawBodies.map((b, i) => [`submission ${i + 1}`, b])]) {
      if (body.includes(needle)) {
        failures++;
        console.log(`FAIL  hidden data "${needle}" found in ${where}`);
      }
    }
  }
  if (!failures) console.log("PASS  no hidden test data in the problem page or any submission response");

  console.log(failures ? `\n${failures} failure(s)` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
