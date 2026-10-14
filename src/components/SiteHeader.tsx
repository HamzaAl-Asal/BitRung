import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";
import { Logo } from "./Logo";
import styles from "./SiteHeader.module.scss";

export default async function SiteHeader({ current }: { current?: "problems" }) {
  const user = await getCurrentUser();
  return (
    <header className={`container ${styles.header}`}>
      <Logo />
      <nav aria-label="Main" className={styles.nav}>
        <Link href="/problems" className="pill" aria-current={current === "problems" ? "page" : undefined}>
          Problems
        </Link>
        {user ? (
          <>
            <span className={styles.who}>{user.displayName}</span>
            <form action={signOut}>
              <button type="submit" className="pill">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/sign-in" className="pill">
              Sign in
            </Link>
            <Link href="/sign-up" className="pill pill--active">
              Sign up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
