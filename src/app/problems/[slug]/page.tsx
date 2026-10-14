import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { getProblemDetail, levelLabel } from "@/lib/problems";
import { DAILY_LIMITS, usedToday } from "@/lib/submissions";
import { Editor, HeaderActions, WorkspaceProvider } from "./Workspace";
import styles from "./workspace.module.scss";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getProblemDetail(params.slug, null);
  return { title: p?.title ?? "Problem" };
}

const paragraphs = (text: string) => text.split(/\n\s*\n/).filter(Boolean);

export default async function ProblemPage({ params }: { params: { slug: string } }) {
  const user = await getCurrentUser();
  const p = await getProblemDetail(params.slug, user?.id ?? null);
  if (!p) notFound();
  const used = user ? await usedToday(user.id) : null;

  return (
    <WorkspaceProvider
      slug={p.slug}
      signedIn={!!user}
      initialBookmarked={p.isBookmarked}
      initialUsed={used}
      limits={DAILY_LIMITS}
    >
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Logo />
          <Link href="/problems" className={`pill ${styles.back}`}>
            Back to problems
          </Link>
        </div>
        <HeaderActions signInHref={`/sign-in?next=${encodeURIComponent(`/problems/${p.slug}`)}`} />
      </header>

      <main className={styles.layout}>
        <section className={`card rise ${styles.statement}`} aria-labelledby="problem-title">
          <div className={styles.meta}>
            <span className="level" data-level={p.level}>
              {levelLabel(p.level)}
            </span>
            <span>
              Rating {p.rating} · {p.timeLimitMs} ms · {p.memoryLimitMb} MB
            </span>
            {p.isSolved && <span className={styles.solved}>Solved</span>}
          </div>
          <h1 id="problem-title" className={styles.title}>
            {p.title}
          </h1>
          {paragraphs(p.statement).map((t, i) => (
            <p key={i} className={styles.prose}>
              {t}
            </p>
          ))}
          <div className={styles.block}>
            <h2 className={styles.h2}>Input</h2>
            <p>{p.input}</p>
          </div>
          <div className={styles.block}>
            <h2 className={styles.h2}>Output</h2>
            <p>{p.output}</p>
          </div>
          {p.samples.map((s, i) => (
            <div key={i} className={styles.samples}>
              <div className={styles.sample}>
                <span className={styles.sampleLabel}>Sample input {p.samples.length > 1 ? i + 1 : ""}</span>
                <pre>{s.input.trimEnd()}</pre>
              </div>
              <div className={styles.sample}>
                <span className={styles.sampleLabel}>Sample output {p.samples.length > 1 ? i + 1 : ""}</span>
                <pre>{s.expectedOutput.trimEnd()}</pre>
              </div>
            </div>
          ))}
          {p.tags.length > 0 && (
            <ul className={styles.tagList} aria-label="Topics">
              {p.tags.map((t) => (
                <li key={t} className="pill pill--sm">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Editor languages={p.languages} signInHref={`/sign-in?next=${encodeURIComponent(`/problems/${p.slug}`)}`} />
      </main>
    </WorkspaceProvider>
  );
}
