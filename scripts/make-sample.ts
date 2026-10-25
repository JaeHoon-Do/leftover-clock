// Builds the sample fridge in public/sample/ from two real photos: shrunk and re-encoded (no EXIF,
// so no GPS), brand labels blurred, then matched once with the app's own matcher and saved, so the
// live app can replay the matching scene without any API call.
//   npx tsx scripts/make-sample.ts                (photos + one matching run: 3 Gemini requests)
//   npx tsx scripts/make-sample.ts --photos-only  (re-make the photos only; sample.json is kept)
import { writeFileSync } from "node:fs";
import exifr from "exifr";
import sharp from "sharp";
import { combine, padBox, type Box } from "../lib/boxes";
import { mapContainers, searchContainers } from "../server/gemini";

const PHOTOS = "leftover-clock-photos";
const OUT = "public/sample";

// Only the printed brand names and logos, found by eye on a 0–1000 grid of each photo: small
// soft-edged patches, so the rest of each package and every container stays sharp.
const DAYS: { file: string; out: string; blur: Box[] }[] = [
  {
    file: "IMG_0661.jpeg",
    out: "day1.jpg",
    blur: [
      [350, 78, 425, 152], [350, 190, 368, 295], [275, 320, 300, 380], [272, 455, 292, 505], [340, 742, 415, 810],
      [448, 138, 468, 190], [645, 165, 692, 275], [695, 85, 725, 245], [643, 535, 656, 580], [696, 0, 714, 85],
    ],
  },
  {
    file: "IMG_0674.jpeg",
    out: "day2.jpg",
    blur: [
      [297, 0, 352, 70], [300, 60, 336, 150], [298, 170, 325, 270], [205, 300, 230, 340], [205, 440, 225, 480],
      [255, 448, 285, 470], [300, 772, 372, 842], [295, 838, 312, 862], [415, 80, 442, 140], [500, 50, 552, 118],
      [650, 55, 692, 200], [697, 42, 724, 200], [634, 55, 648, 95],
    ],
  },
];
const FEATHER = 6; // px of soft edge around each patch
const GROW = 2 * FEATHER; // px each patch grows by, so the soft edge falls outside the box, not on the letters

async function prepare(file: string, blur: Box[]): Promise<Buffer> {
  const base = await sharp(`${PHOTOS}/${file}`).rotate().resize(1200, 1600, { fit: "inside" }).toBuffer();
  const { width = 0, height = 0 } = await sharp(base).metadata();
  // A blurred copy shows through a white-on-black mask whose rectangles are themselves blurred.
  const rects = blur
    .map(([y0, x0, y1, x1]) => {
      const x = (x0 * width) / 1000 - GROW, y = (y0 * height) / 1000 - GROW;
      return `<rect x="${x}" y="${y}" width="${((x1 - x0) * width) / 1000 + 2 * GROW}" height="${((y1 - y0) * height) / 1000 + 2 * GROW}" rx="${GROW}" fill="#fff"/>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#000"/>${rects}</svg>`;
  const mask = await sharp(Buffer.from(svg)).blur(FEATHER).extractChannel(0).toBuffer();
  const overlay = await sharp(base).blur(16).joinChannel(mask).png().toBuffer();
  return sharp(base).composite([{ input: overlay }]).jpeg({ quality: 85 }).toBuffer(); // no withMetadata(): EXIF dropped
}

async function crop(photo: Buffer, box: Box): Promise<string> {
  const { width = 0, height = 0 } = await sharp(photo).metadata();
  const [y0, x0, y1, x1] = padBox(box);
  const left = Math.floor((x0 * width) / 1000);
  const top = Math.floor((y0 * height) / 1000);
  const buf = await sharp(photo)
    .extract({ left, top, width: Math.ceil((x1 * width) / 1000) - left, height: Math.ceil((y1 * height) / 1000) - top })
    .resize(256, 256, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buf.toString("base64");
}

async function main() {
  process.loadEnvFile(".env.local");
  const photos = await Promise.all(DAYS.map((d) => prepare(d.file, d.blur)));
  DAYS.forEach((d, i) => writeFileSync(`${OUT}/${d.out}`, photos[i]));
  if (process.argv.includes("--photos-only")) return;
  const takenAt = await Promise.all(DAYS.map(async (d) => ((await exifr.parse(`${PHOTOS}/${d.file}`, ["DateTimeOriginal"])).DateTimeOriginal as Date).getTime()));
  const [day1, day2] = photos.map((p) => p.toString("base64"));

  const first = await mapContainers({ newPhoto: day1, prevPhoto: null, known: [] });
  const known = first.containers.map((c, i) => ({ id: `c${i + 1}`, box: c.box, desc: c.desc }));
  const step1 = await mapContainers({ newPhoto: day2, prevPhoto: day1, known });
  const matched = new Set(step1.containers.map((c) => c.match));
  const targets = await Promise.all(known.filter((k) => !matched.has(k.id)).map(async (k) => ({ id: k.id, box: k.box, crop: await crop(photos[0], k.box) })));
  const step2 = await searchContainers({ newPhoto: day2, claimed: step1.containers.filter((c) => c.match).map((c) => c.box), targets });

  const sample = {
    name: "Sample fridge",
    day1: { file: "day1.jpg", takenAt: takenAt[0], model: first.model, containers: first.containers },
    day2: { file: "day2.jpg", takenAt: takenAt[1], model: step1.model, step1: step1.containers, found: step2.found },
  };
  writeFileSync(`${OUT}/sample.json`, JSON.stringify(sample, null, 1));
  const final = combine(step1.containers, step2.found);
  console.log(`day1: ${first.containers.length} containers · day2: ${final.filter((c) => c.source === "match").length} matched, ${step2.found.length} found by search, ${final.filter((c) => c.source === "new").length} new`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
