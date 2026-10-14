import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container" style={{ padding: "48px 48px 72px", display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start" }}>
        <h1 style={{ fontSize: 56 }}>Missed a rung.</h1>
        <p style={{ margin: 0, fontSize: 18 }}>That page isn&apos;t here.</p>
        <Link href="/problems" className="btn btn--dark btn--lg">
          Back to problems
        </Link>
      </main>
    </>
  );
}
