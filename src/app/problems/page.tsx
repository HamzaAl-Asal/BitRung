import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth";
import { catalogueQuery, LEVELS, levelLabel, listProblems, type CatalogueQuery } from "@/lib/problems";
import styles from "./problems.module.scss";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Problems" };

function href(q: CatalogueQuery, change: Partial<CatalogueQuery>) {
  const next = { ...q, page: 1, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.level) params.set("level", next.level);
  if (next.status) params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const s = params.toString();
  return s ? `/problems?${s}` : "/problems";
}

const STATUSES = ["Solved", "Attempted", "Unsolved"] as const;

export default async function ProblemsPage({ searchParams }: { searchParams: Record<string, string | string[]> }) {
  const query = catalogueQuery.parse(
    Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
  );
  const user = await getCurrentUser();
  const { problems, total, page, pageCount } = await listProblems(query, user?.id ?? null);

  return (
    <>
      <SiteHeader current="problems" />
      <main className={`container ${styles.main}`}>
        <div className={styles.top}>
          <h1 className={`${styles.h1} rise`}>Pick a problem</h1>
          <form role="search" action="/problems" className={`field ${styles.search}`}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" type="search" placeholder="Title or topic" defaultValue={query.q ?? ""} maxLength={100} />
            {query.level && <input type="hidden" name="level" value={query.level} />}
            {query.status && <input type="hidden" name="status" value={query.status} />}
          </form>
        </div>

        <nav aria-label="Filter by level" className={styles.chips}>
          <Link href={href(query, { level: undefined })} className="pill" aria-current={!query.level ? "page" : undefined}>
            All
          </Link>
          {LEVELS.map((l) => (
            <Link
              key={l.value}
              href={href(query, { level: l.value })}
              className={`pill ${styles.levelChip}`}
              data-level={l.value}
              aria-current={query.level === l.value ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {user && (
          <nav aria-label="Filter by status" className={styles.chips}>
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={href(query, { status: query.status === s ? undefined : s })}
                className="pill"
                aria-current={query.status === s ? "page" : undefined}
              >
                {s}
              </Link>
            ))}
          </nav>
        )}

        <ul className={styles.list}>
          {problems.map((p) => (
            <li key={p.slug}>
              <Link href={`/problems/${p.slug}`} className={`card ${styles.row}`}>
                {p.status && (
                  <span className={styles.status} data-status={p.status}>
                    {p.status}
                  </span>
                )}
                <span className={styles.name}>
                  <span className={styles.title}>{p.title}</span>
                  {p.tags.length > 0 && <span className={styles.tags}>{p.tags.join(" · ")}</span>}
                </span>
                <span className="level" data-level={p.level}>
                  {levelLabel(p.level)}
                </span>
                <span className={styles.rating} aria-label={`Rating ${p.rating}`}>
                  {p.rating}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {problems.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyTitle}>Nothing on this rung yet</span>
            <span>Try another level{query.q ? " or a different search" : ""}.</span>
          </div>
        )}

        <div className={styles.pager}>
          <span>
            {total === 1 ? "1 problem" : `${total} problems`}
            {pageCount > 1 && ` · page ${page} of ${pageCount}`}
          </span>
          {pageCount > 1 && (
            <span className={styles.pagerLinks}>
              {page > 1 ? (
                <Link href={href(query, { page: page - 1 })} className="btn">
                  Previous
                </Link>
              ) : (
                <span className="btn" aria-disabled="true">Previous</span>
              )}
              {page < pageCount ? (
                <Link href={href(query, { page: page + 1 })} className="btn btn--dark">
                  Next
                </Link>
              ) : (
                <span className="btn" aria-disabled="true">Next</span>
              )}
            </span>
          )}
        </div>
      </main>
    </>
  );
}
