"use client";
import { remove, stillThere } from "@/lib/actions";
import { ageText } from "@/lib/age";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./UnseenShelf.module.css";

export interface ShelfItem {
  id: string;
  crop?: Blob;
  dateStart: number;
  /** "Still there" was tapped since the latest photo. */
  stillThere: boolean;
}

function Jar({ item, onTap }: { item: ShelfItem; onTap: () => void }) {
  const url = useObjectUrl(item.crop);
  return (
    <figure className={styles.jar} data-shelf={item.id}>
      <button className={styles.open} onClick={onTap} aria-label={`Container, ${ageText(item.dateStart)}`}>
        <img src={url ?? "/jar.svg"} alt="" />
      </button>
      <figcaption>{ageText(item.dateStart)}</figcaption>
      {item.stillThere ? (
        <span className={styles.tag}>Still there ✓</span>
      ) : (
        <button className={styles.small} onClick={() => stillThere(item.id)}>
          Still there
        </button>
      )}
      <button className={`${styles.small} ${styles.gone}`} onClick={() => remove(item.id)}>
        Removed
      </button>
    </figure>
  );
}

/** Containers that weren't found in the latest photo, on a drawn shelf below it. */
export function UnseenShelf({ items, onTap }: { items: ShelfItem[]; onTap: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.shelf}>
      <h2 className={styles.title}>Not seen in this photo</h2>
      <div className={styles.row}>
        {items.map((it) => (
          <Jar key={it.id} item={it} onTap={() => onTap(it.id)} />
        ))}
      </div>
      <div className={styles.board} aria-hidden />
    </section>
  );
}
