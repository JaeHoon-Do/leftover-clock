"use client";
import Link from "next/link";
import type { MatchError } from "@/lib/matching-client";
import styles from "./PhotoCheck.module.css";

const CHECKS = ["Is the photo blurry?", "Is the fridge door fully open?", "Is the light on?"];

/**
 * Shown when a photo can't be matched. Like an ID-card scanner: a few checks, then retake or
 * upload another. After a second failure it gives up plainly; nothing was saved either way.
 */
export function PhotoCheck({
  kind,
  gaveUp,
  onFile,
}: {
  kind: MatchError["kind"];
  gaveUp: boolean;
  onFile: (file: File, fromCamera: boolean) => void;
}) {
  const service = kind === "busy" || kind === "quota";
  return (
    <div className={`card ${styles.card}`}>
      {kind === "busy" ? (
        <h2>Gemini is busy right now. Try again in a minute.</h2>
      ) : kind === "quota" ? (
        <h2>Today&apos;s free matching is used up.</h2>
      ) : gaveUp ? (
        <>
          <h2>We couldn&apos;t read this photo.</h2>
          <p className="muted">Your fridge stays as it was.</p>
        </>
      ) : (
        <>
          <h2>Let&apos;s check the photo</h2>
          <ul className={styles.checks}>
            {CHECKS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </>
      )}
      {kind === "quota" && (
        <>
          <p className="muted">It resets at midnight Pacific time. Your fridge stays as it was.</p>
          <p>
            <Link href="/">Try the sample fridge</Link> in the meantime. It needs no matching.
          </p>
        </>
      )}
      {(!gaveUp || service) && (
        <div className={styles.buttons}>
          <label className="pill accent">
            {service ? "Take another" : "Retake"}
            <input type="file" accept="image/*" capture="environment" className="visually-hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0], true)} />
          </label>
          <label className="pill">
            Upload another
            <input type="file" accept="image/*" className="visually-hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0], false)} />
          </label>
        </div>
      )}
    </div>
  );
}
