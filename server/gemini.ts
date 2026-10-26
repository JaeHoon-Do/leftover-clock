// Server-only: holds the Gemini key. Used by app/api/* and by eval/run-eval.ts.
import { ApiError, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { area, intersection, normalizeBox, type Box, type FoundContainer, type MatchedContainer } from "../lib/boxes";

export const PRIMARY_MODEL = "gemini-3.6-flash";
const TIMEOUT_MS = 40_000;

export interface Known {
  id: string;
  box: Box;
  desc?: string;
}

export interface SearchTarget {
  id: string;
  /** base64 JPEG crop of the container from an earlier photo. */
  crop: string;
  /** Its box on that earlier photo, used to reject implausibly large finds. */
  box: Box;
}

export class GeminiError extends Error {
  constructor(public kind: "busy" | "quota" | "unreadable", message: string) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 1 } } });
  return client;
}

const jpeg = (data: string): Part => ({ inlineData: { mimeType: "image/jpeg", data } });

const BOX_SCHEMA = { type: "array", items: { type: "integer" }, minItems: 4, maxItems: 4 };

const MAP_SCHEMA = {
  type: "object",
  properties: {
    containers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          box_2d: BOX_SCHEMA,
          match: { type: "string" },
          confidence: { type: "number" },
          desc: { type: "string" },
        },
        required: ["box_2d", "match", "confidence", "desc"],
      },
    },
  },
  required: ["containers"],
};

const SEARCH_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          found: { type: "boolean" },
          box_2d: BOX_SCHEMA,
          confidence: { type: "number" },
        },
        required: ["id", "found", "confidence"],
      },
    },
  },
  required: ["results"],
};

const WHAT_COUNTS = `A food storage container is a lidded box, tub, bowl, or jar without a retail label, or a pot or pan with a lid. Include containers that are partly hidden, stacked, pushed to the back, or show only a lid or an edge. Ignore packaged retail products (anything with a printed label or brand), bottles, cartons, eggs, loose produce, bags, and drawers.`;

function mapPrompt(known: Known[]): string {
  if (known.length === 0) {
    return `The image is a photo of a home fridge.
Find every food storage container in it. ${WHAT_COUNTS}
For each one return box_2d ([ymin, xmin, ymax, xmax], normalized 0-1000), match = "new", confidence (0-1) that it is a food storage container, and desc: a short visual description (lid color, shape, material, where it sits). Never name or guess the food.`;
  }
  return `Image 1 is the PREVIOUS photo of a home fridge. Image 2 is the NEW photo of the same fridge, taken later (the camera position may differ a little).
Known containers on the PREVIOUS photo (box_2d = [ymin, xmin, ymax, xmax], normalized 0-1000):
${JSON.stringify(known.map((k) => ({ id: k.id, box_2d: k.box, ...(k.desc ? { desc: k.desc } : {}) })))}

Find every food storage container in the NEW photo. ${WHAT_COUNTS}
For each one, decide whether it is the same physical container as one of the known ones:
- Judge by lid color, body shape and material, and size first. Position is weak evidence: containers get moved, and a different container can sit exactly where an old one used to be.
- If the lid color or body shape clearly differs, it is not the same container, even in the same spot.
- Each known id can be used at most once. If no known container fits, use match = "new".
- confidence (0-1): how sure you are about the match, or that it is new. Use lower values when the container is partly hidden or the evidence is mostly its position.
- desc: a short visual description (lid color, shape, material, where it sits). Never name or guess the food.
Return box_2d for the NEW photo.`;
}

function searchPrompt(targets: SearchTarget[], claimed: Box[]): string {
  return `Image 1 is a NEW photo of a home fridge. After it come close-up crops of specific food storage containers, cut from earlier photos of the same fridge: ${targets.map((t) => t.id).join(", ")}.
For each crop, decide whether that exact physical container is visible anywhere in the NEW photo, even if it is partly hidden behind other things, pushed to the back, stacked under something, or shows only its lid or an edge. Compare lid color and shape, body material, and size; a merely similar container is not a match.
These areas of the NEW photo already belong to other containers, so don't return them: ${JSON.stringify(claimed)}
For each id return found, box_2d in the NEW photo ([ymin, xmin, ymax, xmax], normalized 0-1000) when found, and confidence (0-1).`;
}

/** The free tier's daily request limit: retrying won't help until it resets. */
function isDailyQuota(e: unknown): boolean {
  return e instanceof ApiError && e.status === 429 && /PerDay/.test(e.message);
}

function isRetryable(e: unknown): boolean {
  if (isDailyQuota(e)) return false;
  // an empty or blocked answer doesn't parse, and a retry won't change that
  if (e instanceof SyntaxError) return false;
  if (e instanceof ApiError) return e.status === 429 || e.status === 503 || e.status === 500 || e.status === 504;
  // timeouts and network failures surface as plain errors
  return true;
}

/**
 * One retry on busy/timeout, then give up. No fallback to a smaller model: on the tuning pair
 * 3.5 Flash-Lite copied the previous boxes and linked 18 of 23 containers wrongly, which would
 * silently give them other containers' dates. "Try again in a minute" is better than wrong dates.
 */
async function generate(parts: Part[], schema: object, model?: string): Promise<{ model: string; json: unknown; failures: string[] }> {
  const attempts = [model ?? PRIMARY_MODEL, model ?? PRIMARY_MODEL];
  const failures: string[] = [];
  let last: unknown;
  for (const [i, m] of attempts.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await ai().models.generateContent({
        model: m,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: schema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      return { model: m, json: JSON.parse(res.text ?? ""), failures };
    } catch (e) {
      last = e;
      failures.push(`${m}: ${e instanceof ApiError ? e.status : e instanceof Error ? e.message.slice(0, 80) : e}`);
      if (!isRetryable(e)) break;
    }
  }
  const msg = last instanceof Error ? last.message : String(last);
  throw new GeminiError(isDailyQuota(last) ? "quota" : isRetryable(last) ? "busy" : "unreadable", msg);
}

/** Step 1: find every container in the new photo and map it to the known ones. */
export async function mapContainers(
  input: { newPhoto: string; prevPhoto: string | null; known: Known[] },
  opts: { model?: string } = {},
): Promise<{ model: string; failures: string[]; containers: MatchedContainer[] }> {
  const known = input.prevPhoto ? input.known : [];
  const ids = new Set(known.map((k) => k.id));
  const parts = [...(input.prevPhoto ? [jpeg(input.prevPhoto)] : []), jpeg(input.newPhoto), { text: mapPrompt(known) }];
  const { model, json, failures } = await generate(parts, MAP_SCHEMA, opts.model);
  const raw = (json as { containers?: { box_2d: number[]; match: string; confidence: number; desc: string }[] }).containers ?? [];
  const containers = raw
    .filter((c) => Array.isArray(c.box_2d) && c.box_2d.length === 4)
    .map((c) => ({
      box: normalizeBox(c.box_2d),
      match: ids.has(c.match) ? c.match : null,
      confidence: c.confidence,
      desc: c.desc ?? "",
    }));
  return { model, failures, containers };
}

/** Step 2: look for specific known containers that step 1 didn't find. */
export async function searchContainers(
  input: { newPhoto: string; claimed: Box[]; targets: SearchTarget[] },
  opts: { model?: string } = {},
): Promise<{ model: string; failures: string[]; found: FoundContainer[]; notFound: string[] }> {
  if (input.targets.length === 0) return { model: opts.model ?? PRIMARY_MODEL, failures: [], found: [], notFound: [] };
  const parts: Part[] = [jpeg(input.newPhoto)];
  for (const t of input.targets) parts.push({ text: `Crop ${t.id}:` }, jpeg(t.crop));
  parts.push({ text: searchPrompt(input.targets, input.claimed) });
  const { model, json, failures } = await generate(parts, SEARCH_SCHEMA, opts.model);
  const raw = (json as { results?: { id: string; found: boolean; box_2d?: number[]; confidence: number }[] }).results ?? [];
  const found: FoundContainer[] = [];
  for (const r of raw) {
    const target = input.targets.find((t) => t.id === r.id);
    if (!r.found || r.box_2d?.length !== 4 || !target || found.some((f) => f.id === r.id)) continue;
    const box = normalizeBox(r.box_2d);
    // The prompt asks for this, but the model doesn't always obey: drop boxes that are
    // mostly another container's claimed box, or far bigger than the container was before.
    if (input.claimed.some((c) => intersection(c, box) > 0.5 * area(box))) continue;
    if (area(box) > 4 * area(target.box)) continue;
    found.push({ id: r.id, box, confidence: r.confidence });
  }
  const notFound = input.targets.map((t) => t.id).filter((id) => !found.some((f) => f.id === id));
  return { model, failures, found, notFound };
}
