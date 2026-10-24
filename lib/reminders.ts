// Reminder cards shown while matching runs, computed from this fridge's own history.
import { db, type Sighting } from "./db";

export interface ReminderCard {
  title: string;
  body?: string;
  containers: { id: string; crop?: Blob; dateStart: number }[];
}

/** The clearest sighting we have of a container: the largest box (spec.md > Unseen Shelf). */
export function clearestSighting(sightings: Sighting[]): Sighting | undefined {
  const area = (s: Sighting) => (s.box[2] - s.box[0]) * (s.box[3] - s.box[1]);
  return [...sightings].sort((a, b) => area(b) - area(a))[0];
}

export async function computeReminders(fridgeId: string): Promise<ReminderCard[]> {
  const active = (await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active");
  if (active.length === 0) {
    return [
      {
        title: "Registering your containers for the first time…",
        body: "Tip: photos taken from about the same spot match best.",
        containers: [],
      },
    ];
  }
  const sightings = await db.sightings.where("containerId").anyOf(active.map((c) => c.id)).toArray();
  const crop = (id: string) => clearestSighting(sightings.filter((s) => s.containerId === id))?.crop;
  const cards: ReminderCard[] = [];

  const oldest = [...active].sort((a, b) => a.dateStart - b.dateStart).slice(0, 3);
  cards.push({ title: "These are your oldest containers", containers: oldest.map((c) => ({ id: c.id, crop: crop(c.id), dateStart: c.dateStart })) });

  const refills = await db.events.where("fridgeId").equals(fridgeId).filter((e) => e.type === "refilled").toArray();
  const lastRefill = new Map<string, { count: number; last: number }>();
  for (const e of refills) {
    if (!e.containerId) continue;
    const r = lastRefill.get(e.containerId) ?? { count: 0, last: 0 };
    lastRefill.set(e.containerId, { count: r.count + 1, last: Math.max(r.last, e.at) });
  }
  const often = active
    .filter((c) => (lastRefill.get(c.id)?.count ?? 0) >= 2)
    .sort((a, b) => lastRefill.get(a.id)!.last - lastRefill.get(b.id)!.last)
    .slice(0, 3);
  if (often.length > 0) {
    cards.push({
      title: "You refill these often, but it's been a while",
      containers: often.map((c) => ({ id: c.id, crop: crop(c.id), dateStart: c.dateStart })),
    });
  }
  return cards;
}
