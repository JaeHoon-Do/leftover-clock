"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { PhotoMap, type MapPin } from "@/components/PhotoMap";
import { ageChip } from "@/lib/age";
import { db, latestPhoto } from "@/lib/db";
import styles from "./fridge.module.css";

export default function FridgeView() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const data = useLiveQuery(async () => {
    const fridge = await db.fridges.get(fridgeId);
    const photo = await latestPhoto(fridgeId);
    if (!fridge || !photo) return { fridge, photo, pins: [] as MapPin[] };
    const sightings = await db.sightings.where("photoId").equals(photo.id).toArray();
    const containers = new Map((await db.containers.where("fridgeId").equals(fridgeId).toArray()).map((c) => [c.id, c]));
    const pins: MapPin[] = sightings
      .filter((s) => containers.get(s.containerId)?.status === "active")
      .map((s) => ({ id: s.containerId, box: s.box, text: ageChip(containers.get(s.containerId)!.dateStart) }));
    return { fridge, photo, pins };
  }, [fridgeId]);

  if (!data) return null;
  const { fridge, photo, pins } = data;
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
