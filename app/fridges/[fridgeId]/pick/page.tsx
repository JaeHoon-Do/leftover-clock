"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ContainerList, type ListItem } from "@/components/ContainerList";
import { PhotoMap, type MapPin } from "@/components/PhotoMap";
import { merge } from "@/lib/actions";
import { ageChip } from "@/lib/age";
import { db } from "@/lib/db";
import { clearestSighting } from "@/lib/reminders";
import styles from "./pick.module.css";

/** "This is the same container as…": pick it on the most recent earlier photo, or from crops. */
export default function Pick() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const from = useSearchParams().get("from") ?? "";
  const router = useRouter();
  const [mode, setMode] = useState<"photo" | "crops">("photo");

  const data = useLiveQuery(async () => {
    const photos = await db.photos.where("fridgeId").equals(fridgeId).sortBy("takenAt");
    const earlier = photos.at(-2);
    const others = (await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active" && c.id !== from);
    const sightings = await db.sightings.where("containerId").anyOf(others.map((c) => c.id)).toArray();
    const pins: MapPin[] = [];
    const crops: ListItem[] = [];
    for (const c of others) {
      const mine = sightings.filter((s) => s.containerId === c.id);
      const onEarlier = mine.find((s) => s.photoId === earlier?.id);
      if (onEarlier) pins.push({ id: c.id, box: onEarlier.box, text: ageChip(c.dateStart) });
      crops.push({ id: c.id, crop: clearestSighting(mine)?.crop, dateStart: c.dateStart });
    }
    return { earlier, pins, crops };
  }, [fridgeId, from]);

  async function pick(intoId: string) {
    await merge(from, intoId);
    router.replace(`/fridges/${fridgeId}`);
  }

  if (!data) return null;
  const showPhoto = mode === "photo" && data.earlier;
  return (
    <main className={styles.view}>
      <header className={styles.bar}>
        <Link href={`/fridges/${fridgeId}`} className="back">
          ← Cancel
        </Link>
      </header>
      <h1 className={styles.title}>Which container is it?</h1>
      <p className={`muted ${styles.hint}`}>
        {showPhoto ? "Tap it on the earlier photo. It keeps that container's date." : "Tap the matching container. It keeps that container's date."}
      </p>
      {showPhoto ? <PhotoMap photo={data.earlier!} pins={data.pins} onPinTap={pick} /> : <ContainerList items={data.crops} onTap={pick} />}
      {data.earlier && (
        <div className={styles.toggle}>
          <button className="pill ghost" onClick={() => setMode(mode === "photo" ? "crops" : "photo")}>
            {mode === "photo" ? "Show as a list of crops" : "Show the earlier photo"}
          </button>
        </div>
      )}
    </main>
  );
}
