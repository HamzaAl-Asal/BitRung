import Link from "next/link";
import styles from "./SiteHeader.module.scss";

// Ladder mark: two rails, three rungs, the top one green.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="7" y="2" width="3.5" height="28" rx="1.75" fill="#111" />
      <rect x="21.5" y="2" width="3.5" height="28" rx="1.75" fill="#111" />
      <rect x="10.5" y="22" width="11" height="3" fill="#111" />
      <rect x="10.5" y="15" width="11" height="3" fill="#6B7684" />
      <rect x="10.5" y="8" width="11" height="3" fill="#1FB75B" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className={styles.logo}>
      <LogoMark />
      <span>
        bitrung<span className={styles.semi}>;</span>
      </span>
    </Link>
  );
}
