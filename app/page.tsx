"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FridgeCard } from "@/components/FridgeCard";
import { db } from "@/lib/db";
import { importSample } from "@/lib/sample";
import styles from "./home.module.css";

export default function FridgeList() {
  const fridges = useLiveQuery(() => db.fridges.orderBy("createdAt").toArray());
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  if (!fridges) return null;

  async function trySample() {
    setLoading(true);
    router.push(`/fridges/${await importSample()}`);
  }
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
      {!fridges.some((f) => f.sample) && (
        <div className={`card ${styles.sample}`}>
          <p>
            <strong>Just looking?</strong> Open a real fridge with a day of history, then add the next day&apos;s photo and watch the
            matching.
          </p>
          <button className="pill mint" onClick={trySample} disabled={loading}>
            Try the sample fridge
          </button>
        </div>
      )}
    </main>
  );
}
