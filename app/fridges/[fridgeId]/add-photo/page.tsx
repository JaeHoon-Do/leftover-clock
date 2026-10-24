"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { fromLocalInput, toLocalInput } from "@/lib/age";
import { matchAndSave, MatchError } from "@/lib/matching-client";
import { readTakenAt, shrink } from "@/lib/photo";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./add-photo.module.css";

type Picked = { blob: Blob; width: number; height: number; takenAt: number; dateFrom: "camera" | "photo" | "now" };

export default function AddPhoto() {
  const { fridgeId } = useParams<{ fridgeId: string }>();
  const router = useRouter();
  const [picked, setPicked] = useState<Picked>();
  const [phase, setPhase] = useState<"pick" | "matching" | "failed">("pick");
  const [error, setError] = useState<MatchError["kind"]>();
  const preview = useObjectUrl(picked?.blob);

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
    try {
      await matchAndSave(fridgeId, picked);
      router.replace(`/fridges/${fridgeId}`);
    } catch (e) {
      setError(e instanceof MatchError ? e.kind : "unreadable");
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
        <div className={`card ${styles.center}`}>
          <div className={styles.spinner} aria-hidden />
          <h2>Matching your containers…</h2>
          <p className="muted">This takes about 10–20 seconds.</p>
        </div>
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
              {phase === "failed" && <p className={styles.error}>{errorText(error)}</p>}
              <button className={`pill accent ${styles.start}`} onClick={start}>
                {phase === "failed" ? "Try again" : "Start matching"}
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

function errorText(kind: MatchError["kind"] | undefined): string {
  switch (kind) {
    case "busy":
      return "Gemini is busy right now. Try again in a minute.";
    case "quota":
      return "Today's free matching is used up. It resets at midnight Pacific time.";
    case "empty":
      return "No containers were found in this photo.";
    default:
      return "We couldn't read this photo.";
  }
}
