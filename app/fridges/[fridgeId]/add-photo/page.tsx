"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PhotoCheck } from "@/components/PhotoCheck";
import { Reminders } from "@/components/Reminders";
import { fromLocalInput, toLocalInput } from "@/lib/age";
import { matchAndSave, MatchError } from "@/lib/matching-client";
import { readTakenAt, shrink } from "@/lib/photo";
import { computeReminders, type ReminderCard } from "@/lib/reminders";
import { db } from "@/lib/db";
import { replaySampleMatch, sampleNextPhoto } from "@/lib/sample";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./add-photo.module.css";

type Picked = { blob: Blob; width: number; height: number; takenAt: number; dateFrom: "camera" | "photo" | "now"; replay?: boolean };

export default function AddPhoto() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const router = useRouter();
  const [picked, setPicked] = useState<Picked>();
  const [phase, setPhase] = useState<"pick" | "matching" | "failed">("pick");
  const [error, setError] = useState<MatchError["kind"]>();
  const [unreadable, setUnreadable] = useState(0);
  const [cards, setCards] = useState<ReminderCard[]>([]);
  const preview = useObjectUrl(picked?.blob);
  // the sample fridge offers its saved next-day photo while it still has only its first one
  const offerSample = useLiveQuery(async () => {
    const f = await db.fridges.get(fridgeId);
    return !!f?.sample && (await db.photos.where("fridgeId").equals(fridgeId).count()) === 1;
  }, [fridgeId]);

  async function pick(file: File | undefined, fromCamera: boolean) {
    if (!file) return;
    const stored = fromCamera ? null : await readTakenAt(file);
    const takenAt = fromCamera ? Date.now() : stored ?? Date.now();
    const shrunk = await shrink(file);
    setPicked({ ...shrunk, takenAt, dateFrom: fromCamera ? "camera" : stored ? "photo" : "now" });
    setPhase("pick");
  }

  async function start() {
    if (!picked) return;
    setPhase("matching");
    setCards(await computeReminders(fridgeId));
    try {
      if (picked.replay) {
        await new Promise((r) => setTimeout(r, 5000)); // let the reminders show, as in a live match
        await replaySampleMatch(fridgeId);
        return router.replace(`/fridges/${fridgeId}`);
      }
      await matchAndSave(fridgeId, picked);
      router.replace(`/fridges/${fridgeId}`);
    } catch (e) {
      const kind = e instanceof MatchError ? e.kind : "unreadable";
      if (kind === "unreadable" || kind === "empty") setUnreadable((n) => n + 1);
      setError(kind);
      setPhase("failed");
    }
  }

  return (
    <main className="page">
      <Link href={`/fridges/${fridgeId}`} className="back">
        ← Fridge
      </Link>
      <h1 className={styles.title}>Add a photo</h1>

      {phase === "matching" ? (
        <>
          <div className={styles.matching}>
            <div className={styles.spinner} aria-hidden />
            <span>Matching your containers… about 20 seconds</span>
          </div>
          <Reminders cards={cards} />
        </>
      ) : phase === "failed" && error ? (
        <PhotoCheck kind={error} gaveUp={unreadable >= 2} onFile={pick} />
      ) : (
        <>
          <div className={styles.buttons}>
            <label className="pill accent">
              Take photo
              <input type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={(e) => pick(e.target.files?.[0], true)} />
            </label>
            <label className="pill">
              Upload
              <input type="file" accept="image/*" className="visually-hidden" onChange={(e) => pick(e.target.files?.[0], false)} />
            </label>
          </div>

          {offerSample && !picked && (
            <div className={`card ${styles.sampleOffer}`}>
              <p>This is the sample fridge. Add the photo taken the next day and watch it match.</p>
              <button className="pill mint" onClick={async () => setPicked({ ...(await sampleNextPhoto()), dateFrom: "photo", replay: true })}>
                Add the next day&apos;s photo
              </button>
            </div>
          )}
          {picked && preview && (
            <div className="card">
              <img src={preview} alt="New fridge photo" className={styles.preview} />
              <label className={styles.label} htmlFor="when">
                Taken
              </label>
              <input
                id="when"
                type="datetime-local"
                value={toLocalInput(picked.takenAt)}
                onChange={(e) => e.target.value && setPicked({ ...picked, takenAt: fromLocalInput(e.target.value) })}
              />
              <p className={styles.hint}>
                {picked.dateFrom === "photo"
                  ? "Read from the photo. Change it if it's wrong."
                  : picked.dateFrom === "camera"
                    ? "The time you took it."
                    : "This photo has no date in it, so it's set to now. Change it if you took it earlier."}
              </p>
              <button className={`pill accent ${styles.start}`} onClick={start}>
                Start matching
              </button>
            </div>
          )}
          <p className={styles.notice}>
            Photos are sent to Google&apos;s Gemini API to find the containers. It runs on the free tier, so Google may use them to
            improve its products.
          </p>
        </>
      )}
    </main>
  );
}

