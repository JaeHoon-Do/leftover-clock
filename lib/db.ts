// Everything lives on the phone, in IndexedDB. Rows change only in lib/actions.ts.
import Dexie, { type EntityTable } from "dexie";
import type { Box, FinalContainer } from "./boxes";

export type FridgeImage = { kind: "illustration"; key: string } | { kind: "photo"; blob: Blob };

export interface Fridge {
  id: string;
  name: string;
  image: FridgeImage;
  createdAt: number;
}

export interface Photo {
  id: string;
  fridgeId: string;
  takenAt: number;
  /** Shrunk JPEG, re-encoded, so no EXIF (and no GPS). */
  blob: Blob;
  width: number;
  height: number;
  model: string;
  createdAt: number;
}

export interface Container {
  id: string;
  fridgeId: string;
  /** When the food now inside went in (scope.md > What the Date Means). */
  dateStart: number;
  status: "active" | "removed";
  createdAt: number;
}

export interface Sighting {
  id: string;
  containerId: string;
  photoId: string;
  box: Box;
  crop: Blob;
  confidence: number;
  source: FinalContainer["source"] | "fix";
  desc: string;
}

export type EventType = "photo_added" | "added" | "refilled" | "split" | "merged" | "still_there" | "removed";

export interface FridgeEvent {
  id: string;
  fridgeId: string;
  containerId?: string;
  photoId?: string;
  type: EventType;
  at: number;
  detail?: string;
}

export const db = new Dexie("leftover-clock") as Dexie & {
  fridges: EntityTable<Fridge, "id">;
  photos: EntityTable<Photo, "id">;
  containers: EntityTable<Container, "id">;
  sightings: EntityTable<Sighting, "id">;
  events: EntityTable<FridgeEvent, "id">;
};

db.version(1).stores({
  fridges: "id, createdAt",
  photos: "id, fridgeId, [fridgeId+takenAt]",
  containers: "id, fridgeId",
  sightings: "id, containerId, photoId",
  events: "id, fridgeId, containerId, at",
});

/** crypto.randomUUID needs a secure context, which the phone doesn't have over LAN http. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function latestPhoto(fridgeId: string): Promise<Photo | undefined> {
  return db.photos.where("[fridgeId+takenAt]").between([fridgeId, Dexie.minKey], [fridgeId, Dexie.maxKey]).last();
}
