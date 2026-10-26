# Leftover Clock

Packaged food has a printed date. Home leftovers in opaque lidded containers don't. Leftover Clock gives every container in your fridge a "first seen" date **from fridge photos alone**: no typing, no labels. Take one photo whenever you open the fridge; the app finds each container, matches it to earlier photos (even when it was moved or pushed behind something), and pins its age on the photo.

## Try it

- **Live:** https://leftover-clock.vercel.app (open it on a phone; "Try the sample fridge" works without any setup)
- **No photos of your own?** Tap **Try the sample fridge** on the start screen. It has a real fridge's first day already registered; add the next day's photo to watch the matching. The sample replays a saved result, so it works even when the free matching quota is used up.
- Your data stays in your browser (IndexedDB). On iPhone, **Add to Home Screen**: Safari deletes a site's data after 7 days without a visit, but not for Home Screen apps.

## How it works

1. **Map** (`/api/match`): Gemini gets the previous photo with its known containers (boxes + short descriptions) and the new photo, and says which container is which and which are new. Position is treated as weak evidence: a different container can sit where an old one was.
2. **Search** (`/api/search`): every known container that step 1 didn't find is searched for by its close-up crop, to catch the half-hidden ones.
3. Whatever is still not found goes to the **Unseen Shelf** below the photo ("Still there" / "Removed"). Wrong matches are fixed with one tap: **Refilled**, **This is a new container**, **This is the same container as…**

The Gemini key stays on the server (two Next.js route handlers); the server stores nothing. The two routes have no login or rate limit (a proof of concept), so anyone with the URL can use up the day's free quota; the sample fridge keeps working when it is.

## Run it locally

```bash
npm install
echo GEMINI_API_KEY=your-key > .env.local
npm run dev            # http://localhost:3000
npm run dev -- -H 0.0.0.0   # then open http://<PC-IP>:3000 on a phone on the same Wi-Fi
```

Requires Node 22. Get a key at https://aistudio.google.com. On the free tier, `gemini-3.6-flash` allows **20 requests a day** (2 per photo). In development, repeated requests are answered from `.cache/gemini/` so retrying the same photo costs nothing.

## Deploy

`vercel` (CLI), then set `GEMINI_API_KEY` as a Vercel environment variable.

## Measuring the match rate honestly

```bash
npx tsx eval/run-eval.ts --pair eval/truth/0661_0674.json --repeat 2
```

`eval/run-eval.ts` runs the same matcher the app ships on real photo pairs and compares it with an answer key confirmed by hand (`eval/truth/`). It counts **correct links**, **misses**, and **wrong links** separately; a wrong link is the worst error, because a new container inherits an old date. Photos are not in this repo (they carry GPS and brand labels).

Tuning pair (10/22 → 10/23, 23 containers in both photos), `gemini-3.6-flash`, over 5 runs: 19–20 correct links, about 1 wrong link per run. Two prompt variants were tried and reverted (no fewer misses, more wrong links).

**Held-out pairs**, measured once after the prompts were frozen (`gemini-3.6-flash`, one run per pair; the answer keys were confirmed by hand before the run):

| Pair | Correct links | Missed | Wrong links | New containers called new | Removed containers noticed |
|---|---|---|---|---|---|
| 10/23 → 10/25 | 14 / 19 | 3 | 4 | 7 / 9 | 5 / 7 |
| 10/25 → 10/26 (fridge reorganized overnight) | 13 / 24 | 7 | 10 | 1 / 4 | 2 / 4 |
| **Total** | **27 / 43 (63%)** | **10** | **14** | **8 / 13** | **7 / 11** |

```bash
npx tsx eval/run-eval.ts --rescore eval/results/heldout-2026-10-26.json   # prints these tables, no API calls
```

The held-out numbers are much worse than the tuning pair's, and that is the honest number. When the whole fridge was rearranged, several boxes landed near where those containers used to be rather than where they now were: the model leans on the old layout. Wrong links are why the one-tap fixes (**Refilled**, **This is a new container**, **This is the same container as…**) are part of the core flow, not an extra. The first pair's first attempts got "model busy" (503) and returned nothing; the reported run is the first one that finished.

## Privacy

Photos are shrunk and re-encoded on the phone before upload, which removes EXIF (including GPS). They are sent to Google's Gemini API on the free tier, where Google may use them to improve its products.

## License

MIT
