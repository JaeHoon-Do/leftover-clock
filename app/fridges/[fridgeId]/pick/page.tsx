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

/** "This is the same container as…": pick it on any earlier full photo (newest first), or from crops. */
export default function Pick() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const from = useSearchParams().get("from") ?? "";
  const router = useRouter();
  const [mode, setMode] = useState<"photo" | "crops">("photo");
  const [photoId, setPhotoId] = useState<string>();

  const data = useLiveQuery(async () => {
    const photos = await db.photos.where("fridgeId").equals(fridgeId).sortBy("takenAt");
    const earlier = photos.slice(0, -1).reverse();
    const others = (await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active" && c.id !== from);
    const sightings = await db.sightings.where("containerId").anyOf(others.map((c) => c.id)).toArray();
    const pins = new Map<string, MapPin[]>(earlier.map((p) => [p.id, []]));
    const crops: ListItem[] = [];
    for (const c of others) {
      const mine = sightings.filter((s) => s.containerId === c.id);
      for (const s of mine) pins.get(s.photoId)?.push({ id: c.id, box: s.box, text: ageChip(c.dateStart) });
      crops.push({ id: c.id, crop: clearestSighting(mine)?.crop, dateStart: c.dateStart });
    }
    return { earlier, pins, crops };
  }, [fridgeId, from]);

  async function pick(intoId: string) {
    await merge(from, intoId);
    router.replace(`/fridges/${fridgeId}`);
  }

  if (!data) return null;
  const photo = data.earlier.find((p) => p.id === photoId) ?? data.earlier[0];
  const showPhoto = mode === "photo" && photo;
  return (
    <main className={styles.view}>
      <header className={styles.bar}>
        <Link href={`/fridges/${fridgeId}`} className="back">
          ← Cancel
        </Link>
      </header>
      <h1 className={styles.title}>Which container is it?</h1>
      <p className={`muted ${styles.hint}`}>
        {showPhoto ? "Tap it on an earlier photo. It keeps that container's date." : "Tap the matching container. It keeps that container's date."}
      </p>
      {showPhoto && data.earlier.length > 1 && (
        <div className={styles.dates}>
          {data.earlier.map((p) => (
            <button key={p.id} className={`pill ${p.id === photo.id ? "mint" : "ghost"}`} onClick={() => setPhotoId(p.id)}>
              {new Date(p.takenAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </button>
          ))}
        </div>
      )}
      {showPhoto ? <PhotoMap photo={photo} pins={data.pins.get(photo.id) ?? []} onPinTap={pick} /> : <ContainerList items={data.crops} onTap={pick} />}
      {photo && (
        <div className={styles.toggle}>
          <button className="pill ghost" onClick={() => setMode(mode === "photo" ? "crops" : "photo")}>
            {mode === "photo" ? "Show as a list of crops" : "Show the earlier photos"}
          </button>
        </div>
      )}
    </main>
  );
}
