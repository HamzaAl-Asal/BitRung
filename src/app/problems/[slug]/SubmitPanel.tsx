"use client";

import { useEffect, useRef, useState } from "react";

type Lang = { id: number; name: string; starter: string };
type Result = {
  status: string;
  language: string;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  compilerOutput: string | null;
  tests: { n: number; status: string }[];
};

const PENDING = new Set(["Queued", "Processing"]);

export default function SubmitPanel({ slug, languages }: { slug: string; languages: Lang[] }) {
  const [langId, setLangId] = useState(languages[0]?.id);
  const [code, setCode] = useState<Record<number, string>>(() =>
    Object.fromEntries(languages.map((l) => [l.id, l.starter])),
  );
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function poll(id: string) {
    const res = await fetch(`/api/submissions/${id}`, { cache: "no-store" });
    const data: Result = await res.json();
    setResult(data);
    if (PENDING.has(data.status)) timer.current = setTimeout(() => poll(id), 700);
    else setBusy(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemSlug: slug, languageId: langId, sourceCode: code[langId!] }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Submit failed");
      setBusy(false);
      return;
    }
    poll(data.id);
  }

  return (
    <section>
      <label>
        Language{" "}
        <select value={langId} onChange={(e) => setLangId(Number(e.target.value))}>
          {languages.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>{" "}
      <button onClick={submit} disabled={busy}>{busy ? "Judging…" : "Submit"}</button>
      <p>
        <label htmlFor="code">Code</label>
      </p>
      <textarea
        id="code"
        rows={22}
        spellCheck={false}
        value={code[langId!] ?? ""}
        onChange={(e) => setCode({ ...code, [langId!]: e.target.value })}
      />
      {error && <p role="alert">Error: {error}</p>}
      {result && (
        <div aria-live="polite">
          <h2>{result.status}</h2>
          <p>
            {result.language} · {result.passedCount}/{result.totalCount} tests
            {result.executionTimeMs !== null && ` · ${result.executionTimeMs} ms`}
            {result.memoryUsedKb !== null && ` · ${(result.memoryUsedKb / 1024).toFixed(1)} MB`}
          </p>
          <p>{result.tests.map((t) => `T${t.n}:${t.status === "Accepted" ? "pass" : t.status === "Queued" || t.status === "Processing" ? "…" : "fail"}`).join("  ")}</p>
          {result.compilerOutput && <pre>{result.compilerOutput}</pre>}
        </div>
      )}
    </section>
  );
}
