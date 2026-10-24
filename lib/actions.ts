// Every change to the stored rows, each in one transaction together with its event.
import type { FinalContainer } from "./boxes";
import { db, latestPhoto, newId, type Container, type FridgeEvent, type FridgeImage, type Sighting } from "./db";
import { cropBox } from "./photo";

export async function addFridge(name: string, image: FridgeImage): Promise<string> {
  const id = newId();
  await db.fridges.add({ id, name, image, createdAt: Date.now() });
  return id;
}

export interface NewPhoto {
  blob: Blob;
  width: number;
  height: number;
  takenAt: number;
  model: string;
}

/**
 * Save a matched photo: the photo, a crop and sighting per container, matched ones on their
 * existing container, the rest as new containers dated to the photo.
 * `containers[].match` holds real container IDs here (the client maps Gemini's aliases back).
 */
export async function applyMatch(fridgeId: string, photo: NewPhoto, containers: FinalContainer[]): Promise<string> {
  const photoId = newId();
  // Crops use canvas (async), which can't run inside an IndexedDB transaction.
  const crops = await Promise.all(containers.map((c) => cropBox(photo.blob, c.box)));
  const now = Date.now();
  await db.transaction("rw", [db.photos, db.containers, db.sightings, db.events], async () => {
    await db.photos.add({ id: photoId, fridgeId, ...photo, createdAt: now });
    const events: FridgeEvent[] = [{ id: newId(), fridgeId, photoId, type: "photo_added", at: photo.takenAt }];
    const newContainers: Container[] = [];
    const sightings: Sighting[] = containers.map((c, i) => {
      let containerId = c.match;
      if (!containerId) {
        containerId = newId();
        newContainers.push({ id: containerId, fridgeId, dateStart: photo.takenAt, status: "active", createdAt: now });
        events.push({ id: newId(), fridgeId, containerId, photoId, type: "added", at: photo.takenAt });
      }
      return { id: newId(), containerId, photoId, box: c.box, crop: crops[i], confidence: c.confidence, source: c.source, desc: c.desc };
    });
    await db.containers.bulkAdd(newContainers);
    await db.sightings.bulkAdd(sightings);
    await db.events.bulkAdd(events);
  });
  return photoId;
}

/** "Refilled": new food in the same container. The date becomes the latest photo's date. */
export async function refill(containerId: string): Promise<void> {
  const c = (await db.containers.get(containerId))!;
  const photo = await latestPhoto(c.fridgeId);
  await db.transaction("rw", [db.containers, db.events], async () => {
    await db.containers.update(containerId, { dateStart: photo?.takenAt ?? Date.now() });
    await db.events.add({ id: newId(), fridgeId: c.fridgeId, containerId, photoId: photo?.id, type: "refilled", at: Date.now() });
  });
}

/** "This is a new container": split this sighting off as a new container dated to its photo. */
export async function split(sightingId: string): Promise<string> {
  const s = (await db.sightings.get(sightingId))!;
  const old = (await db.containers.get(s.containerId))!;
  const photo = (await db.photos.get(s.photoId))!;
  const id = newId();
  const now = Date.now();
  await db.transaction("rw", [db.containers, db.sightings, db.events], async () => {
    await db.containers.add({ id, fridgeId: old.fridgeId, dateStart: photo.takenAt, status: "active", createdAt: now });
    await db.sightings.update(sightingId, { containerId: id, source: "fix" });
    await db.events.bulkAdd([
      { id: newId(), fridgeId: old.fridgeId, containerId: id, photoId: photo.id, type: "split", at: now, detail: "Marked as a new container" },
      { id: newId(), fridgeId: old.fridgeId, containerId: old.id, photoId: photo.id, type: "split", at: now, detail: "A different container was split off" },
    ]);
  });
  return id;
}

/**
 * "This is the same container as…": `fromId` is folded into `intoId`, which keeps its date and
 * history. Where both were seen on the same photo, the sighting the user just fixed wins.
 */
export async function merge(fromId: string, intoId: string): Promise<void> {
  const from = (await db.containers.get(fromId))!;
  const now = Date.now();
  await db.transaction("rw", [db.containers, db.sightings, db.events], async () => {
    const moving = await db.sightings.where("containerId").equals(fromId).toArray();
    const photos = new Set(moving.map((s) => s.photoId));
    const clash = (await db.sightings.where("containerId").equals(intoId).toArray()).filter((s) => photos.has(s.photoId));
    await db.sightings.bulkDelete(clash.map((s) => s.id));
    await db.sightings.bulkUpdate(moving.map((s) => ({ key: s.id, changes: { containerId: intoId, source: "fix" as const } })));
    await db.events.where("containerId").equals(fromId).delete();
    await db.containers.delete(fromId);
    await db.events.add({ id: newId(), fridgeId: from.fridgeId, containerId: intoId, type: "merged", at: now, detail: "Joined with a container the app thought was new" });
  });
}

/** Unseen Shelf: it's still in the fridge, just not visible in this photo. */
export async function stillThere(containerId: string): Promise<void> {
  const c = (await db.containers.get(containerId))!;
  await db.events.add({ id: newId(), fridgeId: c.fridgeId, containerId, type: "still_there", at: Date.now() });
}

/** Unseen Shelf: it's gone from the fridge. */
export async function remove(containerId: string): Promise<void> {
  const c = (await db.containers.get(containerId))!;
  await db.transaction("rw", [db.containers, db.events], async () => {
    await db.containers.update(containerId, { status: "removed" });
    await db.events.add({ id: newId(), fridgeId: c.fridgeId, containerId, type: "removed", at: Date.now() });
  });
}
