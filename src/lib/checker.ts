// Output comparison policy. Pure functions so they can be unit-tested.

export type CheckerKind = "Exact" | "TokenCompare";

// Normalise line endings and trailing whitespace on every line, and trailing blank lines.
export function normalise(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export function check(kind: CheckerKind, actual: string, expected: string): boolean {
  if (kind === "Exact") return normalise(actual) === normalise(expected);
  const a = actual.split(/\s+/).filter(Boolean);
  const e = expected.split(/\s+/).filter(Boolean);
  return a.length === e.length && a.every((t, i) => t === e[i]);
}
