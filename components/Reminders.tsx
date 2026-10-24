"use client";
import { useEffect, useState } from "react";
import { ageText } from "@/lib/age";
import type { ReminderCard } from "@/lib/reminders";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./Reminders.module.css";

function Jar({ crop, dateStart }: { crop?: Blob; dateStart: number }) {
  const url = useObjectUrl(crop);
  return (
    <figure className={styles.jar}>
      <img src={url ?? "/jar.svg"} alt="" />
      <figcaption>{ageText(dateStart)}</figcaption>
    </figure>
  );
}

/** Rotating reminder cards, shown while matching runs. */
export function Reminders({ cards }: { cards: ReminderCard[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (cards.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % cards.length), 4500);
    return () => clearInterval(t);
  }, [cards.length]);
  const card = cards[i % Math.max(1, cards.length)];
  if (!card) return null;
  return (
    <div className={`card ${styles.card}`} key={i}>
      <h2 className={styles.title}>{card.title}</h2>
      {card.body && <p className="muted">{card.body}</p>}
      {card.containers.length > 0 && (
        <div className={styles.row}>
          {card.containers.map((c) => (
            <Jar key={c.id} crop={c.crop} dateStart={c.dateStart} />
          ))}
        </div>
      )}
    </div>
  );
}
