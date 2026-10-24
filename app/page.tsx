"use client";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { FridgeCard } from "@/components/FridgeCard";
import { db } from "@/lib/db";
import styles from "./home.module.css";

export default function FridgeList() {
  const fridges = useLiveQuery(() => db.fridges.orderBy("createdAt").toArray());
  if (!fridges) return null;
  return (
    <main className="page">
      <header className={styles.header}>
        <h1>Leftover Clock</h1>
        <p className="muted">How old is everything in your fridge? Just take a photo.</p>
      </header>
      {fridges.length === 0 ? (
        <div className={`card ${styles.empty}`}>
          <img src="/fridges/mint.svg" alt="" className={styles.emptyArt} />
          <p>No fridges yet. Add yours and take its first photo.</p>
          <Link href="/fridges/new" className="pill accent">
            Add fridge
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {fridges.map((f) => (
              <FridgeCard key={f.id} fridge={f} />
            ))}
          </div>
          <div className={styles.actions}>
            <Link href="/fridges/new" className="pill accent">
              Add fridge
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
