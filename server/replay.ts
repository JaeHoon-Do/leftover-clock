// Development only: answer a repeated Gemini request from disk, so retrying the same
// photo while building costs none of the free tier's 20 requests a day.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const DIR = ".cache/gemini";

export async function replay<T>(kind: string, request: unknown, run: () => Promise<T>): Promise<T> {
  if (process.env.NODE_ENV !== "development") return run();
  const key = createHash("sha256").update(kind).update(JSON.stringify(request)).digest("hex").slice(0, 32);
  const file = `${DIR}/${kind}-${key}.json`;
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    // not recorded yet
  }
  const out = await run();
  await mkdir(DIR, { recursive: true });
  await writeFile(file, JSON.stringify(out));
  return out;
}
