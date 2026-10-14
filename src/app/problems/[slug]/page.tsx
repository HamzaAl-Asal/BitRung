import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SubmitPanel from "./SubmitPanel";

export const dynamic = "force-dynamic";

export default async function ProblemPage({ params }: { params: { slug: string } }) {
  // Public fields only. Hidden tests are filtered to samples here, on the server.
  const p = await prisma.problem.findFirst({
    where: { slug: params.slug, status: "Published" },
    select: {
      slug: true,
      title: true,
      statementMarkdown: true,
      inputDescription: true,
      outputDescription: true,
      difficultyLevel: true,
      difficultyRating: true,
      timeLimitMs: true,
      memoryLimitMb: true,
      testCases: {
        where: { isSample: true },
        orderBy: { sequence: "asc" },
        select: { input: true, expectedOutput: true },
      },
      languages: {
        where: { language: { isEnabled: true } },
        select: { starterCode: true, language: { select: { id: true, name: true } } },
      },
    },
  });
  if (!p) notFound();

  return (
    <main>
      <p><a href="/">← problems</a></p>
      <div className="row">
        <section>
          <h1>{p.title}</h1>
          <p>
            {p.difficultyLevel} · rating {p.difficultyRating} · {p.timeLimitMs} ms · {p.memoryLimitMb} MB
          </p>
          <p>{p.statementMarkdown}</p>
          <h3>Input</h3>
          <p>{p.inputDescription}</p>
          <h3>Output</h3>
          <p>{p.outputDescription}</p>
          {p.testCases.map((s, i) => (
            <div key={i}>
              <h4>Sample {i + 1}</h4>
              <pre>{s.input}</pre>
              <pre>{s.expectedOutput}</pre>
            </div>
          ))}
        </section>
        <SubmitPanel
          slug={p.slug}
          languages={p.languages.map((l) => ({ id: l.language.id, name: l.language.name, starter: l.starterCode }))}
        />
      </div>
    </main>
  );
}
