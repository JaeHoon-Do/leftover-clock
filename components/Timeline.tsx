"use client";
import { dateText } from "@/lib/age";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./Timeline.module.css";

export interface TimelineEntry {
  id: string;
  at: number;
  text: string;
  image?: Blob;
  kind: "photo" | "sighting" | "event";
}

function Entry({ e }: { e: TimelineEntry }) {
  const url = useObjectUrl(e.image);
  return (
    <li className={styles.entry} data-entry={e.kind}>
      <span className={styles.dot} aria-hidden />
      {url && <img src={url} alt="" className={e.kind === "photo" ? styles.photo : styles.crop} />}
      <div>
        <p className={styles.text}>{e.text}</p>
        <p className="muted">{dateText(e.at)}</p>
      </div>
    </li>
  );
}

/** Newest first. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.at - a.at);
  if (sorted.length === 0) return <p className="muted">Nothing has happened here yet.</p>;
  return (
    <ol className={styles.list}>
      {sorted.map((e) => (
        <Entry key={e.id} e={e} />
      ))}
    </ol>
  );
}
