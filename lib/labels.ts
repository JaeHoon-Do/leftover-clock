// Non-overlapping tooltip placement for the pins on the Fridge View (spec.md > Pin Layout).

export interface LabelInput {
  id: string;
  /** Pin position in displayed pixels. */
  x: number;
  y: number;
  text: string;
}

export interface PlacedLabel {
  id: string;
  /** Top-left of the chip, in displayed pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** True when the chip was nudged away from its pin and needs a leader line. */
  leader: boolean;
}

export const CHIP_HEIGHT = 18;
const GAP = 5;
const MARGIN = 2;
const PIN_RADIUS = 5;

/** Chip width from its text; deterministic so the layout can be checked without a DOM. */
export function chipWidth(text: string): number {
  return Math.ceil(10 + text.length * 6.6);
}

type Rect = { left: number; top: number; width: number; height: number };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width + MARGIN &&
    b.left < a.left + a.width + MARGIN &&
    a.top < b.top + b.height + MARGIN &&
    b.top < a.top + a.height + MARGIN
  );
}

/**
 * Greedy, top of the photo down: try right, left, above, below the pin; keep the first spot
 * that stays inside the photo and overlaps no placed chip or other pin; otherwise nudge
 * outward in small steps around the pin and draw a leader line back to it.
 */
export function placeLabels(pins: LabelInput[], width: number, height: number): PlacedLabel[] {
  const placed: PlacedLabel[] = [];
  const pinRects: Rect[] = pins.map((p) => ({
    left: p.x - PIN_RADIUS,
    top: p.y - PIN_RADIUS,
    width: PIN_RADIUS * 2,
    height: PIN_RADIUS * 2,
  }));
  const inside = (r: Rect) => r.left >= 0 && r.top >= 0 && r.left + r.width <= width && r.top + r.height <= height;
  const free = (r: Rect) => inside(r) && !placed.some((p) => overlaps(p, r)) && !pinRects.some((p) => overlaps(p, r));

  for (const p of [...pins].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = chipWidth(p.text);
    const h = CHIP_HEIGHT;
    const near: Rect[] = [
      { left: p.x + PIN_RADIUS + GAP, top: p.y - h / 2, width: w, height: h },
      { left: p.x - PIN_RADIUS - GAP - w, top: p.y - h / 2, width: w, height: h },
      { left: p.x - w / 2, top: p.y - PIN_RADIUS - GAP - h, width: w, height: h },
      { left: p.x - w / 2, top: p.y + PIN_RADIUS + GAP, width: w, height: h },
    ];
    let spot = near.find(free);
    let leader = false;
    for (let r = 14; !spot && r <= Math.max(width, height); r += 6) {
      for (let k = 0; k < 16 && !spot; k++) {
        const a = (k / 16) * 2 * Math.PI;
        const c = { left: p.x + r * Math.cos(a) - w / 2, top: p.y + r * Math.sin(a) - h / 2, width: w, height: h };
        if (free(c)) spot = c;
      }
      leader = true;
    }
    // A photo too small for every chip: clamp into the photo rather than drop the age.
    spot ??= { left: Math.min(Math.max(0, p.x - w / 2), width - w), top: Math.min(Math.max(0, p.y - h / 2), height - h), width: w, height: h };
    placed.push({ id: p.id, ...spot, leader });
  }
  return placed;
}

/** Number of overlapping chip pairs; used to verify the layout on real photos. */
export function countOverlaps(labels: PlacedLabel[]): number {
  let n = 0;
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) if (overlaps(labels[i], labels[j])) n++;
  return n;
}
