// Every change to the stored rows, each in one transaction together with its event.
import type { FinalContainer } from "./boxes";
import { db, newId, type Container, type FridgeEvent, type FridgeImage, type Sighting } from "./db";
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
