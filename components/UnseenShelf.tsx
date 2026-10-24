"use client";
import { ageText } from "@/lib/age";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./UnseenShelf.module.css";

export interface ShelfItem {
  id: string;
  crop?: Blob;
  dateStart: number;
}

function Jar({ item }: { item: ShelfItem }) {
  const url = useObjectUrl(item.crop);
  return (
    <figure className={styles.jar} data-shelf={item.id}>
      <img src={url ?? "/jar.svg"} alt="" />
      <figcaption>{ageText(item.dateStart)}</figcaption>
    </figure>
  );
}

/** Containers that weren't found in the latest photo, on a drawn shelf below it. */
export function UnseenShelf({ items }: { items: ShelfItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.shelf}>
      <h2 className={styles.title}>Not seen in this photo</h2>
      <div className={styles.row}>
        {items.map((it) => (
          <Jar key={it.id} item={it} />
        ))}
      </div>
      <div className={styles.board} aria-hidden />
    </section>
  );
}
