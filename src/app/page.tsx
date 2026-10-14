import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Ladder from "@/components/Ladder";
import { getCurrentUser } from "@/lib/auth";
import { enabledLanguageNames, featuredProblems, levelLabel } from "@/lib/problems";
import styles from "./home.module.scss";

export const dynamic = "force-dynamic";

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export default async function Home() {
  const [user, problems, languages] = await Promise.all([getCurrentUser(), featuredProblems(3), enabledLanguageNames()]);
  const stats = [
    { big: "5", small: "levels from Easy to Master", tone: styles.yellow },
    { big: "Fast", small: "verdicts with time and memory", tone: styles.green },
    { big: languages[0] ?? "", small: `${joinNames(languages)} supported`, tone: styles.blue },
  ];

  return (
    <>
      <SiteHeader />
      <main>
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <span className={styles.sticker}>Climb the ladder, one bit at a time.</span>
            <h1 className={`${styles.title} rise`}>
              Climb. Solve. <span className={styles.highlight}>Level up.</span>
            </h1>
            <p className={styles.lede}>
              Coding problems with five levels, instant verdicts and a ladder that fills up as you get better.
            </p>
            <div className={styles.ctas}>
              <Link href="/problems" className="btn btn--dark btn--lg">
                Start climbing
              </Link>
              {problems[0] && (
                <Link href={`/problems/${problems[0].slug}`} className="btn btn--lg">
                  Try a sample problem
                </Link>
              )}
            </div>
          </div>
          <div className={styles.heroArt}>
            <Ladder />
          </div>
        </section>

        <section className={`container ${styles.stats}`} aria-label="At a glance">
          {stats.map((s) => (
            <div key={s.small} className={`card rise ${styles.stat} ${s.tone}`}>
              <span className={styles.big}>{s.big}</span>
              <span>{s.small}</span>
            </div>
          ))}
        </section>

        {problems.length > 0 && (
          <section className={`container ${styles.pick}`}>
            <h2 className={styles.h2}>Pick a problem</h2>
            <div className={styles.cards}>
              {problems.map((p) => (
                <Link key={p.slug} href={`/problems/${p.slug}`} className={`card rise ${styles.problemCard}`}>
                  <span className="level" data-level={p.level}>
                    {levelLabel(p.level)}
                  </span>
                  <span className={styles.cardTitle}>{p.title}</span>
                  {p.tags.length > 0 && <span className={styles.tags}>{p.tags.join(" · ")}</span>}
                  <span className={styles.solve}>Solve it</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <span className={styles.footerLine}>One bit at a time. Ready to climb?</span>
          <Link href={user ? "/problems" : "/sign-up"} className={`btn btn--lg ${styles.footerCta}`}>
            {user ? "Go to problems" : "Create a free account"}
          </Link>
        </div>
      </footer>
    </>
  );
}
