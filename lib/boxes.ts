// Box math and the step-1 + step-2 merge, shared by the phone (matching-client)
// and the evaluation script so that what is measured is what ships.

/** [ymin, xmin, ymax, xmax], normalized 0–1000 (Gemini's native format). */
export type Box = [number, number, number, number];

export interface MatchedContainer {
  box: Box;
  /** Known container ID, or null for a new container. */
  match: string | null;
  confidence: number;
  desc: string;
}

export interface FoundContainer {
  id: string;
  box: Box;
  confidence: number;
}

export interface FinalContainer extends MatchedContainer {
  source: "match" | "search" | "new";
}

/** Padding around a box when cutting a crop, as a fraction of the box size. */
export const CROP_PAD = 0.15;

export function area([y0, x0, y1, x1]: Box): number {
  return Math.max(0, y1 - y0) * Math.max(0, x1 - x0);
}

export function intersection(a: Box, b: Box): number {
  return area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
}

export function iou(a: Box, b: Box): number {
  const i = intersection(a, b);
  return i === 0 ? 0 : i / (area(a) + area(b) - i);
}

export function center([y0, x0, y1, x1]: Box): [number, number] {
  return [(y0 + y1) / 2, (x0 + x1) / 2];
}

export function contains([y0, x0, y1, x1]: Box, [y, x]: [number, number]): boolean {
  return y >= y0 && y <= y1 && x >= x0 && x <= x1;
}

/** Clamp to 0–1000 and put the corners in order. */
export function normalizeBox(b: number[]): Box {
  const c = b.slice(0, 4).map((v) => Math.min(1000, Math.max(0, Math.round(v))));
  return [Math.min(c[0], c[2]), Math.min(c[1], c[3]), Math.max(c[0], c[2]), Math.max(c[1], c[3])];
}

export function padBox([y0, x0, y1, x1]: Box, pad = CROP_PAD): Box {
  const dy = (y1 - y0) * pad;
  const dx = (x1 - x0) * pad;
  return normalizeBox([y0 - dy, x0 - dx, y1 + dy, x1 + dx]);
}

/**
 * Merge step 1 (map) and step 2 (search) into the containers to save.
 * - Each known ID is used at most once (the most confident claim keeps it; the rest become new).
 * - A found box that overlaps a step-1 "new" box by more than half replaces it
 *   instead of adding a second container.
 */
export function combine(step1: MatchedContainer[], step2: FoundContainer[]): FinalContainer[] {
  const out: FinalContainer[] = [];
  const used = new Set<string>();
  for (const c of [...step1].sort((a, b) => b.confidence - a.confidence)) {
    if (c.match && !used.has(c.match)) {
      used.add(c.match);
      out.push({ ...c, source: "match" });
    } else {
      out.push({ ...c, match: null, source: "new" });
    }
  }
  for (const f of step2) {
    if (used.has(f.id)) continue;
    used.add(f.id);
    const replaced = out.findIndex(
      (c) => c.source === "new" && intersection(c.box, f.box) > 0.5 * Math.min(area(c.box), area(f.box)),
    );
    const desc = replaced >= 0 ? out[replaced].desc : "";
    if (replaced >= 0) out.splice(replaced, 1);
    out.push({ box: f.box, match: f.id, confidence: f.confidence, desc, source: "search" });
  }
  return out;
}
