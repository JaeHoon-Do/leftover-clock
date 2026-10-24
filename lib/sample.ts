// The sample fridge: two real photos and one saved matching result (made by scripts/make-sample.ts),
// so anyone can try the app without using Gemini's free daily quota.
import { combine, type Box, type FoundContainer, type MatchedContainer } from "./boxes";
import { addFridge, applyMatch, deleteFridge } from "./actions";
import { db } from "./db";

interface SampleData {
  name: string;
  day1: { file: string; takenAt: number; model: string; containers: MatchedContainer[] };
  day2: { file: string; takenAt: number; model: string; step1: MatchedContainer[]; found: FoundContainer[] };
}

async function load(): Promise<SampleData> {
  return (await fetch("/sample/sample.json")).json();
}

async function photo(file: string): Promise<{ blob: Blob; width: number; height: number }> {
  const blob = await (await fetch(`/sample/${file}`)).blob();
  const bmp = await createImageBitmap(blob);
  const size = { width: bmp.width, height: bmp.height };
  bmp.close();
  return { blob, ...size };
}

/** Add the sample fridge with its first day already registered. Returns its ID. */
export async function importSample(): Promise<string> {
  const s = await load();
  const id = await addFridge(s.name, { kind: "illustration", key: "mint" }, true);
  const first = s.day1.containers.map((c) => ({ ...c, match: null, source: "new" as const }));
  await applyMatch(id, { ...(await photo(s.day1.file)), takenAt: s.day1.takenAt, model: s.day1.model }, first);
  return id;
}

export async function resetSample(fridgeId: string): Promise<string> {
  await deleteFridge(fridgeId);
  return importSample();
}

/** The sample's next-day photo, offered on its Add Photo screen. */
export async function sampleNextPhoto() {
  const s = await load();
  return { ...(await photo(s.day2.file)), takenAt: s.day2.takenAt };
}

/**
 * Replay the saved matching result for the next-day photo. The saved result names day-1
 * containers by alias (c1, c2, … in day-1 order); they are found again by their day-1 boxes.
 */
export async function replaySampleMatch(fridgeId: string): Promise<void> {
  const s = await load();
  const firstPhoto = (await db.photos.where("fridgeId").equals(fridgeId).sortBy("takenAt"))[0];
  const sightings = await db.sightings.where("photoId").equals(firstPhoto.id).toArray();
  const same = (a: Box, b: Box) => a.every((v, i) => v === b[i]);
  const idOf = new Map(
    s.day1.containers.map((c, i) => [`c${i + 1}`, sightings.find((x) => same(x.box, c.box))?.containerId ?? null]),
  );
  const final = combine(s.day2.step1, s.day2.found).map((c) => ({ ...c, match: c.match ? idOf.get(c.match) ?? null : null }));
  await applyMatch(fridgeId, { ...(await photo(s.day2.file)), takenAt: s.day2.takenAt, model: s.day2.model }, final);
}
