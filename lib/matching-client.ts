// Runs matching for a new photo: step 1 against the fridge's latest photo, then saves the result.
import { combine, type MatchedContainer } from "./boxes";
import { db, latestPhoto } from "./db";
import { applyMatch, type NewPhoto } from "./actions";
import { toBase64 } from "./photo";

export class MatchError extends Error {
  constructor(public kind: "busy" | "quota" | "unreadable" | "empty") {
    super(kind);
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new MatchError("busy");
  }
  const json = await res.json().catch(() => ({ error: "unreadable" }));
  if (!res.ok) throw new MatchError(json.error ?? "unreadable");
  return json as T;
}

/** Match a new photo against the fridge's latest photo and save everything. Nothing is saved on failure. */
export async function matchAndSave(fridgeId: string, photo: Omit<NewPhoto, "model">): Promise<string> {
  const prev = await latestPhoto(fridgeId);
  // Gemini gets short aliases (c1, c2, …) instead of our long IDs; they're mapped back below.
  const alias = new Map<string, string>();
  let known: { id: string; box: MatchedContainer["box"]; desc: string }[] = [];
  if (prev) {
    const seen = await db.sightings.where("photoId").equals(prev.id).toArray();
    const active = new Set((await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active").map((c) => c.id));
    known = seen
      .filter((s) => active.has(s.containerId))
      .map((s, i) => {
        alias.set(`c${i + 1}`, s.containerId);
        return { id: `c${i + 1}`, box: s.box, desc: s.desc };
      });
  }
  const step1 = await post<{ model: string; containers: MatchedContainer[] }>("/api/match", {
    newPhoto: await toBase64(photo.blob),
    prevPhoto: prev ? await toBase64(prev.blob) : null,
    known,
  });
  if (step1.containers.length === 0) throw new MatchError("empty");
  const final = combine(step1.containers, []).map((c) => ({ ...c, match: c.match ? alias.get(c.match) ?? null : null }));
  return applyMatch(fridgeId, { ...photo, model: step1.model }, final);
}
