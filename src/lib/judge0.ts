import "server-only";

// Thin client for a self-hosted Judge0 CE instance.
// Everything goes over base64: real compiler output can contain bytes that
// are not valid UTF-8, and Judge0 refuses to serialise those as plain JSON.

const JUDGE0_URL = process.env.JUDGE0_URL ?? "http://localhost:2358";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) =>
  s ? Buffer.from(s, "base64").toString("utf8") : "";

export interface Judge0Request {
  languageId: number;
  sourceCode: string;
  stdin: string;
  cpuTimeLimitSec: number;
  memoryLimitKb: number;
  compilerOptions?: string | null;
}

export interface Judge0Result {
  token: string;
  statusId: number;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeSec: number | null;
  memoryKb: number | null;
}

// Judge0 status ids: 1 In Queue, 2 Processing, 3 Accepted, 4 Wrong Answer,
// 5 Time Limit Exceeded, 6 Compilation Error, 7-12 runtime errors,
// 13 Internal Error, 14 Exec Format Error.
export const isFinished = (statusId: number) => statusId >= 3;

export async function submitBatch(reqs: Judge0Request[]): Promise<string[]> {
  const body = {
    submissions: reqs.map((r) => ({
      language_id: r.languageId,
      source_code: b64(r.sourceCode),
      stdin: b64(r.stdin),
      cpu_time_limit: r.cpuTimeLimitSec,
      memory_limit: r.memoryLimitKb,
      compiler_options: r.compilerOptions ?? undefined,
    })),
  };
  const res = await fetch(`${JUDGE0_URL}/submissions/batch?base64_encoded=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Judge0 batch submit failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token?: string; error?: string }[];
  return data.map((d, i) => {
    if (!d.token) throw new Error(`Judge0 rejected submission ${i}: ${JSON.stringify(d)}`);
    return d.token;
  });
}

export async function getBatch(tokens: string[]): Promise<Judge0Result[]> {
  const fields = "token,status_id,stdout,stderr,compile_output,time,memory";
  const res = await fetch(
    `${JUDGE0_URL}/submissions/batch?tokens=${tokens.join(",")}&base64_encoded=true&fields=${fields}`,
  );
  if (!res.ok) throw new Error(`Judge0 batch fetch failed: ${res.status}`);
  const data = (await res.json()) as {
    submissions: {
      token: string;
      status_id: number;
      stdout: string | null;
      stderr: string | null;
      compile_output: string | null;
      time: string | null;
      memory: number | null;
    }[];
  };
  return data.submissions.map((s) => ({
    token: s.token,
    statusId: s.status_id,
    stdout: unb64(s.stdout),
    stderr: unb64(s.stderr),
    compileOutput: unb64(s.compile_output),
    timeSec: s.time === null ? null : Number(s.time),
    memoryKb: s.memory,
  }));
}
