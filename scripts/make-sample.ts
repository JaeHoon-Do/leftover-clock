// Builds the sample fridge in public/sample/ from two real photos: shrunk and re-encoded (no EXIF,
// so no GPS), brand labels blurred, then matched once with the app's own matcher and saved, so the
// live app can replay the matching scene without any API call.
//   npx tsx scripts/make-sample.ts
import { writeFileSync } from "node:fs";
import exifr from "exifr";
import sharp from "sharp";
import { combine, padBox, type Box } from "../lib/boxes";
import { mapContainers, searchContainers } from "../server/gemini";

const PHOTOS = "leftover-clock-photos";
const OUT = "public/sample";

// Printed brand labels, found by eye on a 0–1000 grid of each photo.
const DAYS: { file: string; out: string; blur: Box[] }[] = [
  {
    file: "IMG_0661.jpeg",
    out: "day1.jpg",
    blur: [
      [330, 80, 420, 160], [325, 145, 390, 330], [265, 325, 320, 510], [340, 735, 425, 800],
      [445, 135, 550, 245], [590, 90, 725, 320], [632, 505, 685, 600], [690, 0, 705, 30],
    ],
  },
  {
    file: "IMG_0674.jpeg",
    out: "day2.jpg",
    blur: [
      [290, 0, 395, 100], [210, 285, 275, 500], [292, 80, 330, 300], [300, 760, 390, 860],
      [415, 85, 495, 180], [500, 20, 565, 160], [590, 40, 725, 260],
    ],
  },
];

async function prepare(file: string, blur: Box[]): Promise<Buffer> {
  const base = await sharp(`${PHOTOS}/${file}`).rotate().resize(1200, 1600, { fit: "inside" }).toBuffer();
  const { width = 0, height = 0 } = await sharp(base).metadata();
  const patches = await Promise.all(
    blur.map(async ([y0, x0, y1, x1]) => {
      const left = Math.round((x0 * width) / 1000);
      const top = Math.round((y0 * height) / 1000);
      const w = Math.round(((x1 - x0) * width) / 1000);
      const h = Math.round(((y1 - y0) * height) / 1000);
      return { input: await sharp(base).extract({ left, top, width: w, height: h }).blur(14).toBuffer(), left, top };
    }),
  );
  return sharp(base).composite(patches).jpeg({ quality: 85 }).toBuffer(); // no withMetadata(): EXIF dropped
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
