"use client";
import Link from "next/link";
import type { Fridge, FridgeImage } from "@/lib/db";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./FridgeCard.module.css";

export function FridgeArt({ image, className }: { image: FridgeImage; className?: string }) {
  const url = useObjectUrl(image.kind === "photo" ? image.blob : null);
  const src = image.kind === "photo" ? url : `/fridges/${image.key}.svg`;
  return src ? <img src={src} alt="" className={className} /> : <div className={className} />;
}

export function FridgeCard({ fridge }: { fridge: Fridge }) {
  return (
    <div className={styles.card}>
      <Link href={`/fridges/${fridge.id}`} className={styles.open}>
        <FridgeArt image={fridge.image} className={fridge.image.kind === "photo" ? styles.photo : styles.art} />
        <span className={styles.name}>{fridge.name}</span>
      </Link>
    </div>
  );
}
