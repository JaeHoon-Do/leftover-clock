"use client";
import { ageText, dateText } from "@/lib/age";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./ContainerList.module.css";

export interface ListItem {
  id: string;
  crop?: Blob;
  dateStart: number;
}

function Row({ item, onTap }: { item: ListItem; onTap: () => void }) {
  const url = useObjectUrl(item.crop);
  return (
    <li>
      <button className={styles.row} onClick={onTap} data-row={item.id}>
        <img src={url ?? "/jar.svg"} alt="" />
        <span className={styles.age}>{ageText(item.dateStart)}</span>
        <span className="muted">{dateText(item.dateStart)}</span>
      </button>
    </li>
  );
}

/** "View as list": every active container, oldest first. */
export function ContainerList({ items, onTap }: { items: ListItem[]; onTap: (id: string) => void }) {
  const sorted = [...items].sort((a, b) => a.dateStart - b.dateStart);
  return (
    <ul className={styles.list}>
      {sorted.map((it) => (
        <Row key={it.id} item={it} onTap={() => onTap(it.id)} />
      ))}
    </ul>
  );
}
