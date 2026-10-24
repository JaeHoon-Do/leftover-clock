// Phone-side photo handling: the stored timestamp, shrinking (which drops EXIF), and crops.
import { padBox, type Box } from "./boxes";

/** DateTimeOriginal from the photo, if it kept one. */
export async function readTakenAt(file: Blob): Promise<number | null> {
  try {
    const { default: exifr } = await import("exifr"); // browser-only; keeps it out of prerendering
    const tags = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const d: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
    return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
  } catch {
    return null;
  }
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("could not encode JPEG"))), "image/jpeg", quality),
  );
}

/** Fit inside maxW×maxH and re-encode as JPEG. Re-encoding drops all EXIF, including GPS. */
export async function shrink(file: Blob, maxW = 1200, maxH = 1600): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file); // applies the EXIF orientation
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const width = Math.round(bmp.width * scale);
  const height = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  return { blob: await toJpeg(canvas, 0.85), width, height };
}

/** A small JPEG of one container, with some padding around its box. */
export async function cropBox(photo: Blob, box: Box): Promise<Blob> {
  const bmp = await createImageBitmap(photo);
  const [y0, x0, y1, x1] = padBox(box);
  const sx = (x0 * bmp.width) / 1000;
  const sy = (y0 * bmp.height) / 1000;
  const sw = Math.max(1, ((x1 - x0) * bmp.width) / 1000);
  const sh = Math.max(1, ((y1 - y0) * bmp.height) / 1000);
  const scale = Math.min(1, 256 / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toJpeg(canvas, 0.8);
}

export function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
