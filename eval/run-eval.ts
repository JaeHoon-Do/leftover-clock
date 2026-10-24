// Match-rate evaluation: runs the app's own two-step matcher on real photo pairs
// and compares it with a learner-confirmed answer key.
//
//   npx tsx eval/run-eval.ts --pair eval/truth/<prev>_<next>.json [--pair …] [--photos <folder>]
//        [--model gemini-3.6-flash --model gemini-3.8-flash] [--repeat 3] [--draw <folder>]
//   npx tsx eval/run-eval.ts --rescore eval/results/<file>.json   (score saved predictions again, no API calls)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";
import { center, combine, contains, iou, padBox, type Box, type FinalContainer } from "../lib/boxes";
import { mapContainers, PRIMARY_MODEL, searchContainers, type Known } from "../server/gemini";

interface Truth {
  prevPhoto: string;
  nextPhoto: string;
  known: Known[];
  next: { box: Box; truth: string; desc: string }[];
  absent: string[];
}

interface Counts {
  bothPhotos: number;
  correctLink: number;
  missedAsNew: number;
  missedUnfound: number;
  wrongLink: number;
  newTotal: number;
  newCorrect: number;
  newGivenOldId: number;
  newUndetected: number;
  absentTotal: number;
  absentCorrect: number;
  extra: number;
  extraWithOldId: number;
}

interface PairResult {
  pair: string;
  model: string;
  modelsUsed: string[];
  failures: string[];
  ms: { map: number; search: number };
  step1: unknown;
  step2: unknown;
  final: FinalContainer[];
  truth: Truth;
}

function args(): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i += 2) m.set(a[i].replace(/^--/, ""), [...(m.get(a[i].replace(/^--/, "")) ?? []), a[i + 1]]);
  return m;
}

/** Same preparation as the phone: shrink to fit 1200×1600, re-encode as JPEG (drops EXIF). */
async function loadPhoto(path: string): Promise<Buffer> {
  return sharp(path).rotate().resize(1200, 1600, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
}

async function cropBox(photo: Buffer, box: Box): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(photo).metadata();
  const [y0, x0, y1, x1] = padBox(box);
  const left = Math.floor((x0 * width) / 1000);
  const top = Math.floor((y0 * height) / 1000);
  return sharp(photo)
    .extract({ left, top, width: Math.max(1, Math.ceil((x1 * width) / 1000) - left), height: Math.max(1, Math.ceil((y1 * height) / 1000) - top) })
    .resize(256, 256, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** Line up predicted boxes with truth boxes: best overlap first, one-to-one. */
function align(final: FinalContainer[], truth: Truth): Map<number, number> {
  const pairs: { p: number; t: number; s: number }[] = [];
  final.forEach((f, p) =>
    truth.next.forEach((n, t) => {
      const s = iou(f.box, n.box);
      if (s >= 0.3 || (contains(n.box, center(f.box)) && contains(f.box, center(n.box)))) pairs.push({ p, t, s });
    }),
  );
  const byTruth = new Map<number, number>();
  const usedP = new Set<number>();
  for (const { p, t } of pairs.sort((a, b) => b.s - a.s)) {
    if (usedP.has(p) || byTruth.has(t)) continue;
    usedP.add(p);
    byTruth.set(t, p);
  }
  return byTruth;
}

function score(r: PairResult): { counts: Counts; notes: string[] } {
  const { truth, final } = r;
  const byTruth = align(final, truth);
  const c: Counts = {
    bothPhotos: 0, correctLink: 0, missedAsNew: 0, missedUnfound: 0, wrongLink: 0,
    newTotal: 0, newCorrect: 0, newGivenOldId: 0, newUndetected: 0,
    absentTotal: truth.absent.length, absentCorrect: 0, extra: 0, extraWithOldId: 0,
  };
  const notes: string[] = [];
  truth.next.forEach((n, t) => {
    const p = byTruth.get(t);
    const got = p === undefined ? undefined : final[p];
    if (n.truth === "new") {
      c.newTotal++;
      if (!got) { c.newUndetected++; notes.push(`new not detected: ${n.desc}`); }
      else if (got.match) { c.newGivenOldId++; notes.push(`WRONG: new "${n.desc}" linked to ${got.match} (${got.source}, ${got.confidence})`); }
      else c.newCorrect++;
      return;
    }
    c.bothPhotos++;
    if (!got) { c.missedUnfound++; notes.push(`missed ${n.truth} (not found): ${n.desc}`); }
    else if (got.match === n.truth) c.correctLink++;
    else if (!got.match) { c.missedAsNew++; notes.push(`missed ${n.truth} (called new): ${n.desc}`); }
    else { c.wrongLink++; notes.push(`WRONG: ${n.truth} linked to ${got.match} (${got.source}, ${got.confidence})`); }
  });
  const alignedP = new Set(byTruth.values());
  for (const id of truth.absent) if (!final.some((f) => f.match === id)) c.absentCorrect++;
  final.forEach((f, p) => {
    if (alignedP.has(p)) return;
    // a box that is no truth container but carries an old ID gives an old date to something else: a wrong link
    if (f.match) c.extraWithOldId++;
    else c.extra++;
    notes.push(`${f.match ? "WRONG: " : ""}extra box ${JSON.stringify(f.box)} ${f.match ?? "new"}: ${f.desc}`);
  });
  return { counts: c, notes };
}

async function runPair(file: string, photos: string, model: string): Promise<PairResult> {
  const truth: Truth = JSON.parse(readFileSync(file, "utf8"));
  const prev = await loadPhoto(join(photos, truth.prevPhoto));
  const next = await loadPhoto(join(photos, truth.nextPhoto));
  let t = Date.now();
  const step1 = await mapContainers({ newPhoto: next.toString("base64"), prevPhoto: prev.toString("base64"), known: truth.known }, { model });
  const mapMs = Date.now() - t;
  const matched = new Set(step1.containers.map((c) => c.match).filter(Boolean));
  const targets = await Promise.all(
    truth.known.filter((k) => !matched.has(k.id)).map(async (k) => ({ id: k.id, box: k.box, crop: (await cropBox(prev, k.box)).toString("base64") })),
  );
  t = Date.now();
  const claimed = step1.containers.filter((c) => c.match).map((c) => c.box);
  const step2 = await searchContainers({ newPhoto: next.toString("base64"), claimed, targets }, { model });
  const searchMs = Date.now() - t;
  return {
    pair: basename(file, ".json"),
    model,
    modelsUsed: [step1.model, step2.model],
    failures: [...step1.failures, ...step2.failures],
    ms: { map: mapMs, search: searchMs },
    step1,
    step2,
    final: combine(step1.containers, step2.found),
    truth,
  };
}

async function draw(r: PairResult, photos: string, outDir: string): Promise<string> {
  const img = await loadPhoto(join(photos, r.truth.nextPhoto));
  const { width: W = 0, height: H = 0 } = await sharp(img).metadata();
  const rect = ([y0, x0, y1, x1]: Box, color: string, label: string, dash = "") =>
    `<rect x="${(x0 * W) / 1000}" y="${(y0 * H) / 1000}" width="${((x1 - x0) * W) / 1000}" height="${((y1 - y0) * H) / 1000}" fill="none" stroke="${color}" stroke-width="3" ${dash}/>` +
    `<text x="${(x0 * W) / 1000 + 3}" y="${(y0 * H) / 1000 + 18}" fill="${color}" font-size="18" font-weight="bold" stroke="black" stroke-width="0.6">${label}</text>`;
  const byTruth = align(r.final, r.truth);
  let svg = "";
  r.truth.next.forEach((n, t) => (svg += rect(n.box, "white", `T:${n.truth}`, 'stroke-dasharray="6 4"')));
  r.final.forEach((f, p) => {
    const t = [...byTruth].find(([, pp]) => pp === p)?.[0];
    const want = t === undefined ? undefined : r.truth.next[t].truth;
    const ok = want !== undefined && (want === "new" ? !f.match : f.match === want);
    svg += rect(f.box, ok ? "lime" : want === undefined ? "orange" : "red", `${f.match ?? "new"}${f.source === "search" ? "*" : ""}`);
  });
  const out = join(outDir, `eval_${r.pair}_${r.model}.jpg`);
  await sharp(img).composite([{ input: Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`) }]).toFile(out);
  return out;
}

function report(results: PairResult[]) {
  const totals = new Map<string, Counts>();
  for (const r of results) {
    const { counts: c, notes } = score(r);
    console.log(`\n${r.pair} · ${r.model} (used ${r.modelsUsed.join(", ")}${r.failures?.length ? `; failed: ${r.failures.join(" | ")}` : ""}) · map ${(r.ms.map / 1000).toFixed(1)}s, search ${(r.ms.search / 1000).toFixed(1)}s`);
    console.table({
      "correct link": `${c.correctLink} / ${c.bothPhotos}`,
      "missed (called new)": c.missedAsNew,
      "missed (not found)": c.missedUnfound,
      "wrong link": c.wrongLink + c.newGivenOldId + c.extraWithOldId,
      "new correct": `${c.newCorrect} / ${c.newTotal}`,
      "new not detected": c.newUndetected,
      "absent correct": `${c.absentCorrect} / ${c.absentTotal}`,
      "extra boxes": c.extra,
    });
    for (const n of notes) console.log(`  - ${n}`);
    const t = totals.get(r.model);
    totals.set(r.model, t ? (Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v + c[k as keyof Counts]])) as unknown as Counts) : c);
  }
  console.log("\nTotals per model");
  console.table(
    Object.fromEntries(
      [...totals].map(([m, c]) => [
        m,
        {
          "correct link": `${c.correctLink}/${c.bothPhotos}`,
          missed: c.missedAsNew + c.missedUnfound,
          "wrong link": c.wrongLink + c.newGivenOldId + c.extraWithOldId,
          "new correct": `${c.newCorrect}/${c.newTotal}`,
          "absent correct": `${c.absentCorrect}/${c.absentTotal}`,
          extra: c.extra,
        },
      ]),
    ),
  );
}

async function main() {
  const a = args();
  if (a.has("rescore")) {
    report(JSON.parse(readFileSync(a.get("rescore")![0], "utf8")));
    return;
  }
  process.loadEnvFile(".env.local");
  // real photos stay in this gitignored folder: they carry GPS and brand labels
  const photos = a.get("photos")?.[0] ?? "leftover-clock-photos";
  const pairs = a.get("pair") ?? [];
  if (pairs.length === 0) throw new Error("usage: --pair <truth.json> [--photos <folder>] [--model <name>] [--repeat <n>] [--draw <folder>]");
  const results: PairResult[] = [];
  const repeat = Number(a.get("repeat")?.[0] ?? 1);
  for (const model of a.get("model") ?? [PRIMARY_MODEL]) {
    for (const file of pairs) {
      for (let i = 1; i <= repeat; i++) {
        // the free tier has a per-minute quota; back-to-back runs hit 429
        if (results.length > 0) await new Promise((r) => setTimeout(r, 20_000));
        console.log(`running ${basename(file)} on ${model} (${i}/${repeat})…`);
        try {
          results.push(await runPair(file, photos, model));
        } catch (e) {
          // a busy model is part of the measurement: report it, keep going
          console.log(`  failed: ${e instanceof Error ? e.message.slice(0, 120) : e}`);
        }
      }
    }
  }
  if (results.length === 0) throw new Error("every run failed; nothing to score");
  mkdirSync("eval/results", { recursive: true });
  const out = join("eval/results", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify(results, null, 1));
  report(results);
  console.log(`\nsaved ${out}`);
  const drawDir = a.get("draw")?.[0];
  if (drawDir) for (const r of results) console.log(`drew ${await draw(r, photos, drawDir)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
