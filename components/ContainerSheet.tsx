"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { refill, remove, split, stillThere } from "@/lib/actions";
import { ageText, dateText } from "@/lib/age";
import { db, latestPhoto } from "@/lib/db";
import { eventText } from "@/lib/events";
import { clearestSighting } from "@/lib/reminders";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./ContainerSheet.module.css";

/** Container Detail: a bottom sheet with the crop, age, recent history, and the one-tap fixes. */
export function ContainerSheet({ containerId, onClose }: { containerId: string; onClose: () => void }) {
  const data = useLiveQuery(async () => {
    const c = await db.containers.get(containerId);
    if (!c) return null;
    const photo = await latestPhoto(c.fridgeId);
    const sightings = await db.sightings.where("containerId").equals(containerId).toArray();
    const onLatest = sightings.find((s) => s.photoId === photo?.id);
    const events = (await db.events.where("containerId").equals(containerId).sortBy("at")).reverse();
    return { c, onLatest, crop: (onLatest ?? clearestSighting(sightings))?.crop, events };
  }, [containerId]);
  const url = useObjectUrl(data?.crop);
  // the container was merged away or removed
  useEffect(() => {
    if (data === null) onClose();
  }, [data, onClose]);
  if (!data) return null;
  const { c, onLatest, events } = data;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Container detail">
        <div className={styles.head}>
          <img src={url ?? "/jar.svg"} alt="" className={styles.crop} />
          <div>
            <p className={styles.age} data-age>
              {ageText(c.dateStart)}
            </p>
            <p className="muted">since {dateText(c.dateStart)}</p>
            {!onLatest && <p className={styles.unseen}>Not seen in the latest photo</p>}
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <ul className={styles.events}>
          {events.slice(0, 3).map((e) => (
            <li key={e.id}>
              <span>{eventText(e)}</span>
              <span className="muted">{dateText(e.at)}</span>
            </li>
          ))}
        </ul>
        <div className={styles.buttons}>
          <button className="pill accent" onClick={() => refill(c.id)}>
            Refilled
          </button>
          {onLatest && (
            <>
              <button className="pill" onClick={() => split(onLatest.id).then(onClose)}>
                This is a new container
              </button>
              <Link className="pill mint" href={`/fridges/${c.fridgeId}/pick?from=${c.id}`}>
                This is the same container as…
              </Link>
            </>
          )}
          {!onLatest && (
            <>
              <button className="pill mint" onClick={() => stillThere(c.id)}>
                Still there
              </button>
              <button className="pill ghost" onClick={() => remove(c.id).then(onClose)}>
                Removed
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
