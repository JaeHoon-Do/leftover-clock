"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { center, type Box } from "@/lib/boxes";
import { placeLabels } from "@/lib/labels";
import { useObjectUrl } from "@/lib/use-object-url";
import styles from "./PhotoMap.module.css";

export interface MapPin {
  id: string;
  box: Box;
  text: string;
}

/** The latest photo, edge to edge, with a non-overlapping age chip per container (the chip is the pin). */
export function PhotoMap({
  photo,
  pins,
  onPinTap,
}: {
  photo: { blob: Blob; width: number; height: number };
  pins: MapPin[];
  onPinTap?: (id: string) => void;
}) {
  const url = useObjectUrl(photo.blob);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = width ? (width * photo.height) / photo.width : 0;

  const points = useMemo(
    () =>
      pins.map((p) => {
        const [cy, cx] = center(p.box);
        return { id: p.id, text: p.text, x: (cx / 1000) * width, y: (cy / 1000) * height };
      }),
    [pins, width, height],
  );
  const labels = useMemo(() => (width ? placeLabels(points, width, height) : []), [points, width, height]);
  const byId = new Map(points.map((p) => [p.id, p]));

  return (
    <div ref={ref} className={styles.map} style={{ height: height || undefined }}>
      {url && <img src={url} alt="Fridge photo" className={styles.photo} />}
      <svg className={styles.leaders} width={width} height={height}>
        {labels
          .filter((l) => l.leader)
          .map((l) => {
            const p = byId.get(l.id)!;
            return <line key={l.id} x1={p.x} y1={p.y} x2={l.left + l.width / 2} y2={l.top + l.height / 2} />;
          })}
      </svg>
      {labels.map((l) => (
        <button
          key={`chip-${l.id}`}
          data-chip={l.id}
          className={`${styles.chip} ${l.side ? styles[l.side] : ""}`}
          style={{ left: l.left, top: l.top, width: l.width, height: l.height }}
          aria-label={`Container, ${byId.get(l.id)?.text}`}
          onClick={() => onPinTap?.(l.id)}
        >
          {byId.get(l.id)?.text}
        </button>
      ))}
    </div>
  );
}
