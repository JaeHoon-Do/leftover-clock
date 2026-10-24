"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { PhotoMap, type MapPin } from "@/components/PhotoMap";
import { UnseenShelf, type ShelfItem } from "@/components/UnseenShelf";
import { ageChip } from "@/lib/age";
import { db, latestPhoto } from "@/lib/db";
import { clearestSighting } from "@/lib/reminders";
import styles from "./fridge.module.css";

export default function FridgeView() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const data = useLiveQuery(async () => {
    const fridge = await db.fridges.get(fridgeId);
    const photo = await latestPhoto(fridgeId);
    if (!fridge || !photo) return { fridge, photo, pins: [] as MapPin[], shelf: [] as ShelfItem[] };
    const active = (await db.containers.where("fridgeId").equals(fridgeId).toArray()).filter((c) => c.status === "active");
    const sightings = await db.sightings.where("containerId").anyOf(active.map((c) => c.id)).toArray();
    const pins: MapPin[] = [];
    const shelf: ShelfItem[] = [];
    for (const c of active) {
      const mine = sightings.filter((s) => s.containerId === c.id);
      const onPhoto = mine.find((s) => s.photoId === photo.id);
      if (onPhoto) pins.push({ id: c.id, box: onPhoto.box, text: ageChip(c.dateStart) });
      else shelf.push({ id: c.id, crop: clearestSighting(mine)?.crop, dateStart: c.dateStart });
    }
    return { fridge, photo, pins, shelf };
  }, [fridgeId]);

  if (!data) return null;
  const { fridge, photo, pins, shelf } = data;
  if (!fridge)
    return (
      <main className="page">
        <Link href="/" className="back">
          ← Fridges
        </Link>
        <p>This fridge doesn&apos;t exist on this phone.</p>
      </main>
    );

  return (
    <main className={styles.view}>
      <header className={styles.bar}>
        <Link href="/" className="back">
          ←
        </Link>
        <h1 className={styles.name}>{fridge.name}</h1>
      </header>
      {photo ? (
        <>
          <PhotoMap photo={photo} pins={pins} />
          <UnseenShelf items={shelf} />
          <p className={styles.caption}>
            {pins.length} containers · photo from{" "}
            {new Date(photo.takenAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
          <nav className={styles.floating}>
            <Link href={`/fridges/${fridgeId}/add-photo`} className="pill accent">
              Add photo
            </Link>
          </nav>
        </>
      ) : (
        <div className={`card ${styles.first}`}>
          <h2>Take the first photo</h2>
          <p className="muted">Open the fridge and take one photo. Every container in it gets today&apos;s date, and the next photos keep track from there.</p>
          <Link href={`/fridges/${fridgeId}/add-photo`} className="pill accent">
            Add photo
          </Link>
        </div>
      )}
    </main>
  );
}
