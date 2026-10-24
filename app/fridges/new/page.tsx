"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FridgeArt } from "@/components/FridgeCard";
import { addFridge } from "@/lib/actions";
import type { FridgeImage } from "@/lib/db";
import { shrink } from "@/lib/photo";
import styles from "./new.module.css";

const ILLUSTRATIONS = ["mint", "butter", "tomato", "sky"];

export default function AddFridge() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [image, setImage] = useState<FridgeImage>({ kind: "illustration", key: "mint" });
  const [saving, setSaving] = useState(false);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    const { blob } = await shrink(file, 600, 600);
    setImage({ kind: "photo", blob });
  }

  async function save() {
    setSaving(true);
    const id = await addFridge(name.trim(), image);
    router.replace(`/fridges/${id}`);
  }

  return (
    <main className="page">
      <Link href="/" className="back">
        ← Fridges
      </Link>
      <h1 className={styles.title}>Add a fridge</h1>
      <div className="card">
        <label className={styles.label} htmlFor="name">
          Name
        </label>
        <input id="name" type="text" placeholder="Kitchen fridge" value={name} onChange={(e) => setName(e.target.value)} />
        <p className={styles.label}>Picture</p>
        <div className={styles.grid}>
          {ILLUSTRATIONS.map((key) => (
            <button
              key={key}
              className={`${styles.option} ${image.kind === "illustration" && image.key === key ? styles.selected : ""}`}
              onClick={() => setImage({ kind: "illustration", key })}
              aria-label={`${key} fridge`}
            >
              <img src={`/fridges/${key}.svg`} alt="" />
            </button>
          ))}
          <label className={`${styles.option} ${image.kind === "photo" ? styles.selected : ""}`}>
            {image.kind === "photo" ? <FridgeArt image={image} className={styles.photo} /> : <span>Use my photo</span>}
            <input type="file" accept="image/*" className="visually-hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      <div className={styles.actions}>
        <button className="pill accent" disabled={!name.trim() || saving} onClick={save}>
          Save fridge
        </button>
      </div>
    </main>
  );
}
