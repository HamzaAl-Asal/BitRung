"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import styles from "./workspace.module.scss";

type Kind = "Submit" | "SampleRun";
type Used = Record<Kind, number>;
type Lang = { id: number; name: string; starter: string };
type Result = {
  kind: Kind;
  status: string;
  language: string;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  compilerOutput: string | null;
  tests: { n: number; status: string }[];
};

type Ctx = {
  slug: string;
  signedIn: boolean;
  bookmarked: boolean;
  setBookmarked: (b: boolean) => void;
  used: Used | null;
  setUsed: (u: Used) => void;
  limits: Used;
};
const WorkspaceContext = createContext<Ctx | null>(null);
const useWorkspace = () => useContext(WorkspaceContext)!;

export function WorkspaceProvider(props: {
  slug: string;
  signedIn: boolean;
  initialBookmarked: boolean;
  initialUsed: Used | null;
  limits: Used;
  children: React.ReactNode;
}) {
  const [bookmarked, setBookmarked] = useState(props.initialBookmarked);
  const [used, setUsed] = useState(props.initialUsed);
  return (
    <WorkspaceContext.Provider
      value={{ slug: props.slug, signedIn: props.signedIn, bookmarked, setBookmarked, used, setUsed, limits: props.limits }}
    >
      {props.children}
    </WorkspaceContext.Provider>
  );
}

export function HeaderActions({ signInHref }: { signInHref: string }) {
  const { slug, signedIn, bookmarked, setBookmarked, used, limits } = useWorkspace();
  const [saving, setSaving] = useState(false);

  if (!signedIn) {
    return (
      <Link href={signInHref} className="pill pill--active">
        Sign in to submit
      </Link>
    );
  }

  async function toggle() {
    setSaving(true);
    const next = !bookmarked;
    setBookmarked(next);
    const res = await fetch(`/api/me/problems/${slug}/bookmark`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookmarked: next }),
    }).catch(() => null);
    if (!res?.ok) setBookmarked(!next);
    setSaving(false);
  }

  return (
    <div className={styles.headerRight}>
      <button type="button" className="pill" aria-pressed={bookmarked} onClick={toggle} disabled={saving}>
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </button>
      {used && (
        <span className={styles.quota}>
          {used.Submit} of {limits.Submit} submissions today
        </span>
      )}
    </div>
  );
}

const VERDICT: Record<string, { title: string; tone: string }> = {
  Queued: { title: "Judging…", tone: "pending" },
  Processing: { title: "Judging…", tone: "pending" },
  Accepted: { title: "Accepted!", tone: "accepted" },
  WrongAnswer: { title: "Wrong answer", tone: "wrong" },
  TimeLimitExceeded: { title: "Time limit exceeded", tone: "slow" },
  MemoryLimitExceeded: { title: "Memory limit exceeded", tone: "crash" },
  RuntimeError: { title: "Runtime error", tone: "crash" },
  CompilationError: { title: "Compilation error", tone: "compile" },
  InternalError: { title: "Judge error, try again", tone: "internal" },
};
const PENDING = new Set(["Queued", "Processing"]);

const codeKey = (slug: string, langId: number) => `bitrung:code:${slug}:${langId}`;
const langKey = (slug: string) => `bitrung:lang:${slug}`;
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

export function Editor({ languages, signInHref }: { languages: Lang[]; signInHref: string }) {
  const { slug, signedIn, used, setUsed, limits } = useWorkspace();
  const [langId, setLangId] = useState(languages[0]?.id);
  const [code, setCode] = useState<Record<number, string>>(() =>
    Object.fromEntries(languages.map((l) => [l.id, l.starter])),
  );
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Restore saved code and language after mount, so server and client render the same first.
  useEffect(() => {
    const saved: Record<number, string> = {};
    for (const l of languages) {
      const s = store.get(codeKey(slug, l.id));
      if (s !== null) saved[l.id] = s;
    }
    if (Object.keys(saved).length) setCode((c) => ({ ...c, ...saved }));
    const lastLang = Number(store.get(langKey(slug)));
    if (languages.some((l) => l.id === lastLang)) setLangId(lastLang);
  }, [slug, languages]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const lang = languages.find((l) => l.id === langId) ?? languages[0];
  const current = code[lang.id] ?? lang.starter;

  function edit(value: string) {
    setCode((c) => ({ ...c, [lang.id]: value }));
    if (value === lang.starter) store.remove(codeKey(slug, lang.id));
    else store.set(codeKey(slug, lang.id), value);
  }

  function chooseLanguage(id: number) {
    setLangId(id);
    store.set(langKey(slug), String(id));
  }

  function reset() {
    if (current !== lang.starter && !window.confirm(`Replace your ${lang.name} code with the starter template?`)) return;
    edit(lang.starter);
  }

  const poll = useCallback(async (id: string) => {
    const res = await fetch(`/api/submissions/${id}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Lost track of that run. Refresh to check its result.");
      setBusy(false);
      return;
    }
    const data: Result = await res.json();
    setResult(data);
    if (PENDING.has(data.status)) timer.current = setTimeout(() => poll(id), 700);
    else setBusy(false);
  }, []);

  async function run(kind: Kind) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRound((r) => r + 1);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemSlug: slug, languageId: lang.id, sourceCode: current, kind }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      setError(data.error ?? "Couldn't reach the server. Check your connection and try again.");
      setBusy(false);
      return;
    }
    if (data.usedToday) setUsed(data.usedToday);
    poll(data.id);
  }

  const submitsLeft = used ? limits.Submit - used.Submit : 0;
  const runsLeft = used ? limits.SampleRun - used.SampleRun : 0;
  const v = result ? VERDICT[result.status] ?? VERDICT.InternalError : null;
  const samplesPassed = result?.kind === "SampleRun" && result.status === "Accepted";

  return (
    <section className={styles.workArea} aria-label="Code editor">
      <div className={`card rise ${styles.editorCard}`}>
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <div className="field">
              <label htmlFor="lang">Language</label>
              <select id="lang" value={lang.id} onChange={(e) => chooseLanguage(Number(e.target.value))} className={styles.select}>
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className={`btn ${styles.reset}`} onClick={reset}>
              Reset to template
            </button>
          </div>
          {signedIn ? (
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => run("SampleRun")} disabled={busy || runsLeft <= 0}>
                Run samples
              </button>
              <button type="button" className="btn btn--primary" onClick={() => run("Submit")} disabled={busy || submitsLeft <= 0}>
                {busy ? "Judging…" : "Submit"}
              </button>
            </div>
          ) : (
            <Link href={signInHref} className="btn btn--primary">
              Sign in to submit
            </Link>
          )}
        </div>
        <label htmlFor="code" className="visually-hidden">
          Code
        </label>
        <textarea
          id="code"
          className={`code ${styles.code}`}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          value={current}
          onChange={(e) => edit(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && signedIn) {
              e.preventDefault();
              run("Submit");
            }
          }}
        />
        {signedIn && <p className={styles.hint}>Ctrl+Enter to submit. Your code is saved in this browser.</p>}
      </div>

      <div
        key={round}
        className={`card ${styles.verdict}`}
        data-tone={samplesPassed ? "samples" : v?.tone ?? "idle"}
        aria-live="polite"
      >
        {error ? (
          <>
            <span className={styles.verdictTitle}>Not sent</span>
            <span>{error}</span>
          </>
        ) : !result ? (
          <>
            <span className={styles.verdictTitle}>{busy ? "Sending…" : "No submission yet"}</span>
            <span className={styles.verdictMeta}>{signedIn ? "Run samples or submit" : "Sign in to run your code"}</span>
          </>
        ) : (
          <>
            <div className={styles.verdictHead}>
              <span className={styles.verdictTitle}>{samplesPassed ? "Samples passed" : v!.title}</span>
              {!PENDING.has(result.status) && (
                <span className={styles.verdictMeta}>
                  {[
                    result.language,
                    result.executionTimeMs !== null && result.status !== "CompilationError" ? `${result.executionTimeMs} ms` : null,
                    result.memoryUsedKb ? `${(result.memoryUsedKb / 1024).toFixed(1)} MB` : null,
                    `${result.passedCount} / ${result.totalCount} ${result.kind === "SampleRun" ? "samples" : "tests"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
            {result.tests.length > 0 && result.status !== "CompilationError" && (
              <ol className={styles.tests} aria-label="Test results">
                {result.tests.map((t) => {
                  const state = PENDING.has(t.status) ? "pending" : t.status === "Accepted" ? "pass" : "fail";
                  return (
                    <li key={t.n} className={styles.test} data-state={state}>
                      T{t.n} {state === "pending" ? "…" : state}
                    </li>
                  );
                })}
              </ol>
            )}
            {result.compilerOutput && <pre className={styles.compiler}>{result.compilerOutput}</pre>}
            {result.status === "Accepted" && result.kind === "SampleRun" && (
              <span>Samples only. Submit to run the hidden tests.</span>
            )}
          </>
        )}
        <span className={styles.note}>Hidden tests show only pass or fail. Their data is never shown.</span>
      </div>
    </section>
  );
}
