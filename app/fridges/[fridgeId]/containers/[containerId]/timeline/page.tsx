"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Timeline, type TimelineEntry } from "@/components/Timeline";
import { ageText } from "@/lib/age";
import { db } from "@/lib/db";
import { eventText } from "@/lib/events";

/** Every crop of one container with its photo's time, and every action on it. */
export default function ContainerTimeline() {
  const { fridgeId, containerId } = useParams<{ fridgeId: string; containerId: string }>();
  const data = useLiveQuery(async () => {
    const c = await db.containers.get(containerId);
    const sightings = await db.sightings.where("containerId").equals(containerId).toArray();
    const photos = new Map((await db.photos.bulkGet(sightings.map((s) => s.photoId))).filter((p) => !!p).map((p) => [p!.id, p!]));
    const entries: TimelineEntry[] = [
      ...sightings.map((s) => ({ id: s.id, at: photos.get(s.photoId)?.takenAt ?? 0, text: "Seen in a photo", image: s.crop, kind: "sighting" as const })),
      ...(await db.events.where("containerId").equals(containerId).toArray()).map((e) => ({ id: e.id, at: e.at, text: eventText(e), kind: "event" as const })),
    ];
    return { c, entries };
  }, [containerId]);
  if (!data) return null;
  return (
    <main className="page">
      <Link href={`/fridges/${fridgeId}`} className="back">
        ← Fridge
      </Link>
      <h1 style={{ margin: "12px 0 4px" }}>Container timeline</h1>
      {data.c ? <p className="muted" style={{ marginTop: 0 }}>{ageText(data.c.dateStart)} old{data.c.status === "removed" ? " · removed" : ""}</p> : <p className="muted">This container was joined with another one.</p>}
      <Timeline entries={data.entries} />
    </main>
  );
}
