"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Timeline, type TimelineEntry } from "@/components/Timeline";
import { db } from "@/lib/db";
import { eventText } from "@/lib/events";
import { clearestSighting } from "@/lib/reminders";

/** Everything that happened in one fridge: photos and every container action. */
export default function FridgeTimeline() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const data = useLiveQuery(async () => {
    const fridge = await db.fridges.get(fridgeId);
    const photos = new Map((await db.photos.where("fridgeId").equals(fridgeId).toArray()).map((p) => [p.id, p]));
    const events = await db.events.where("fridgeId").equals(fridgeId).toArray();
    const ids = [...new Set(events.map((e) => e.containerId).filter((id): id is string => !!id))];
    const sightings = await db.sightings.where("containerId").anyOf(ids).toArray();
    const entries: TimelineEntry[] = events.map((e) =>
      e.type === "photo_added"
        ? { id: e.id, at: e.at, text: "Photo added", image: photos.get(e.photoId ?? "")?.blob, kind: "photo" }
        : {
            id: e.id,
            at: e.at,
            text: `Container: ${eventText(e).toLowerCase()}`,
            image: clearestSighting(sightings.filter((s) => s.containerId === e.containerId))?.crop,
            kind: "event",
          },
    );
    return { fridge, entries };
  }, [fridgeId]);
  if (!data) return null;
  return (
    <main className="page">
      <Link href="/" className="back">
        ← Fridges
      </Link>
      <h1 style={{ margin: "12px 0 16px" }}>{data.fridge?.name ?? "Fridge"} timeline</h1>
      <Timeline entries={data.entries} />
    </main>
  );
}
