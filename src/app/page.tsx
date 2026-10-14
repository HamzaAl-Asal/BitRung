import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const problems = await prisma.problem.findMany({
    where: { status: "Published" },
    select: { slug: true, title: true, difficultyLevel: true, difficultyRating: true },
    orderBy: { difficultyRating: "asc" },
  });
  return (
    <main>
      <h1>bitrung;</h1>
      <ul>
        {problems.map((p) => (
          <li key={p.slug}>
            <Link href={`/problems/${p.slug}`}>{p.title}</Link> · {p.difficultyLevel} · {p.difficultyRating}
          </li>
        ))}
      </ul>
    </main>
  );
}
