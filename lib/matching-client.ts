// Runs matching for a new photo: step 1 maps it against the fridge's latest photo, step 2
// searches for every active container step 1 didn't find, then everything is saved at once.
import { combine, type Box, type FoundContainer, type MatchedContainer } from "./boxes";
import { db, latestPhoto } from "./db";
import { applyMatch, type NewPhoto } from "./actions";
import { toBase64 } from "./photo";
import { clearestSighting } from "./reminders";

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

/** Match a new photo and save everything. Nothing is saved on failure. */
export async function matchAndSave(fridgeId: string, photo: Omit<NewPhoto, "model">): Promise<string> {
  const prev = await latestPhoto(fridgeId);
  const active = (await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active");
  const sightings = await db.sightings.where("containerId").anyOf(active.map((c) => c.id)).toArray();

  // Gemini gets short aliases (c1, c2, …) instead of our long IDs; they're mapped back below.
  const aliasOf = new Map(active.map((c, i) => [c.id, `c${i + 1}`]));
  const idOf = new Map([...aliasOf].map(([id, a]) => [a, id]));
  const onPrev = prev ? sightings.filter((s) => s.photoId === prev.id) : [];
  const known = onPrev.map((s) => ({ id: aliasOf.get(s.containerId)!, box: s.box, desc: s.desc }));

  const newPhoto = await toBase64(photo.blob);
  const step1 = await post<{ model: string; containers: MatchedContainer[] }>("/api/match", {
    newPhoto,
    prevPhoto: prev ? await toBase64(prev.blob) : null,
    known,
  });
  if (step1.containers.length === 0) throw new MatchError("empty");

  // Step 2: unmatched containers from the latest photo plus everything on the Unseen Shelf.
  const matched = new Set(step1.containers.map((c) => c.match));
  const missing = active.filter((c) => !matched.has(aliasOf.get(c.id)!));
  let found: FoundContainer[] = [];
  if (prev && missing.length > 0) {
    const targets: { id: string; crop: string; box: Box }[] = [];
    for (const c of missing) {
      const best = clearestSighting(sightings.filter((s) => s.containerId === c.id));
      if (best) targets.push({ id: aliasOf.get(c.id)!, crop: await toBase64(best.crop), box: best.box });
    }
    try {
      const step2 = await post<{ found: FoundContainer[] }>("/api/search", {
        newPhoto,
        claimed: step1.containers.filter((c) => c.match).map((c) => c.box),
        targets,
      });
      found = step2.found;
    } catch {
      // Step 1 already gave a usable result; without the search, the missing ones go to the shelf.
    }
  }

  const final = combine(step1.containers, found).map((c) => ({ ...c, match: c.match ? idOf.get(c.match) ?? null : null }));
  return applyMatch(fridgeId, { ...photo, model: step1.model }, final);
}
