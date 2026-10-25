---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. The matcher runs on real photos and reports an honest match rate**
  Becomes usable: A command that runs the app's own two-step matcher (map, then search for the unmatched) on the 10/22 → 10/23 photo pair and prints correct links, misses, and wrong links against the learner-confirmed answer key, for both candidate models.
  Why now: The kernel is the biggest risk and everything else is a display of its output. This is the one allowed single-layer slice: it proves the critical risk with runnable evidence before any screen depends on it. Bootstrapping (Next.js project, dependencies, `.env.local` wiring) happens here so the matcher already lives where the server routes will call it.
  PRD ref: `prd.md > Matching and Pins`
  Spec ref: `spec.md > Matching Server Routes`, `spec.md > Evaluation Harness`, `spec.md > Gemini API`, `spec.md > Stack`, `spec.md > File Structure`, `spec.md > Verify early in the build` (model choice)
  Build: Scaffold Next.js 16 + TypeScript with pinned versions; add `@google/genai`, `tsx`. Write `server/gemini.ts` (step 1 map prompt with "position is weak evidence", step 2 search prompt with claimed boxes, JSON schemas, retry + fallback model, returned model name). Write `eval/run-eval.ts` (box overlap alignment, the five counts, a table per pair plus totals, raw output to `eval/results/`). Convert the confirmed `정답지.md` for 0661 → 0674 into `eval/truth/0661_0674.json` (IDs, boxes, short descriptions only), and show the learner the converted key to confirm. Run on `gemini-3.6-flash` and `gemini-3.8-flash`, keep the better one as primary. If a 10/24 photo exists, draft its answer key the same way (matcher run + numbered boxes + learner confirms) and add it as a tuning pair.
  Verify (mechanical): `npx tsx eval/run-eval.ts --pair eval/truth/0661_0674.json` (photos from the gitignored `leftover-clock-photos/`) exits 0 and prints the counts table; the totals add up to the containers in the key; a results file is written; `npm run build` passes.
  Learner check: Read the printed table for both models and say whether the numbers match what you saw in the photos (for example, which container was missed or wrongly linked), and which model you want as primary.
  Commit: `Add two-step Gemini matcher and match-rate evaluation`

- [x] **2. You can add a fridge and register its containers from a first photo**
  Becomes usable: On the phone or PC: the Fridge List (empty state, then cards), Add Fridge (name + illustration or own photo), and a Fridge View where uploading or taking the first photo — with its date read from the photo and editable — puts a pin with an age chip on every container, laid out without overlaps. Everything is still there after a reload.
  Why now: It is the first thing a person can actually use, and it carries the riskiest display pieces right behind the matcher: IndexedDB storage, EXIF time, photo shrinking and cropping, and the non-overlapping tooltips on a ~25-container photo.
  PRD ref: `prd.md > The Core Journey` (steps 1-3, 5), `prd.md > Fridges`, `prd.md > Adding a Photo and Its Date`, `prd.md > Matching and Pins` (first photo), `prd.md > States and Boundaries`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Fridge List`, `spec.md > Add Fridge`, `spec.md > Fridge View`, `spec.md > Pin Layout`, `spec.md > Add Photo`, `spec.md > Data Model`, `spec.md > POST /api/match (our route)`, `spec.md > Look and Feel`
  Build: `lib/db.ts` (Dexie schema), `lib/photo.ts` (exifr time, shrink to ~1200×1600 JPEG, crop from box), `lib/age.ts`, `lib/labels.ts`, `app/api/match/route.ts` over `server/gemini.ts` with a development-only record/replay cache of Gemini responses (keyed by the request, so retrying the same photo costs no quota), `lib/actions.ts` `applyMatch` for the first photo (all new), the Fridge List / Add Fridge / Fridge View / Add Photo pages, `FridgeCard`, `PhotoMap`, 4 fridge SVGs, design tokens and fonts for both tones, the Gemini notice on Add Photo.
  Verify (mechanical): `npm run build` passes; with the dev server running, a script or browser run adds a fridge, uploads IMG_0661, confirms the pre-filled time is 10/22 20:15, gets a pin per container, and a check on the rendered tooltip boxes finds zero overlaps; reload shows the same fridge and pins.
  Learner check: Open the app, add a fridge with a name and an illustration (and try your own photo as the image), add your 10/22 photo, and check that its date is right, every container has a pin, and no labels overlap. Say how both looks (the cute screens and the map) feel.
  Commit: `Add fridges and first-photo registration with pins`

- [x] **3. A later photo keeps each container's date, finds the lid-only one, and shelves the rest**
  Becomes usable: Adding the 10/23 photo to the same fridge shows matched containers with their original age, the half-hidden lid-only containers found by the search step, new containers at "today", and the containers not seen in the photo on the Unseen Shelf below it. Reminders show while matching runs; a photo that can't be read leads to the photo check and a retake instead of a crash, and leaves the fridge unchanged.
  Why now: This is the unique kernel inside the app, the "oh, that's cool" beat. It comes right after the first usable screen so the early feedback on it can still change everything that follows.
  PRD ref: `prd.md > The Core Journey` (steps 4-5), `prd.md > Matching and Pins`, `prd.md > Reminders While Matching`, `prd.md > Photo Can't Be Read`, `prd.md > Unseen Shelf` (shown)
  Spec ref: `spec.md > The Core Journey Through the System`, `spec.md > Matching and Reminders`, `spec.md > Photo Check`, `spec.md > POST /api/search (our route)`, `spec.md > Unseen Shelf`, `spec.md > Important Failure Modes`
  Build: `app/api/search/route.ts`; `lib/matching-client.ts` (step 1 against the latest photo and its boxes → step 2 with crops of every unmatched active container → overlap replacement → apply in one transaction, failure → Photo Check, nothing written); `applyMatch` for matched/new/search sources; `Reminders` + `lib/reminders.ts`; `PhotoCheck`; `UnseenShelf` display (largest-box crop or default jar).
  Verify (mechanical): `npm run build` passes; in a browser run, the 10/23 photo after the 10/22 photo gives matched containers an age of 1 day (not "today"), at least one `source: "search"` sighting, and shelf items equal to the active containers with no sighting on the latest photo; a deliberately blurry image reaches Photo Check and the row counts in IndexedDB stay the same.
  Learner check: Add your 10/23 photo to the fridge. Look for the container that only shows its lid: does it have a pin with its 10/22 age? Check the shelf below for anything not seen. Then try a blurry photo and see what happens.
  Commit: `Match later photos, search for hidden containers, show Unseen Shelf`

- [x] **4. One tap fixes anything wrong, and the list shows everything oldest first**
  Becomes usable: Tapping a pin, shelf item, or list row opens Container Detail with its crop, age, and recent history. "Refilled", "This is a new container", and "This is the same container as…" (pin picker on the earlier photo, or a crop grid) each fix it in one tap and the age updates at once. Shelf items have "Still there" / "Removed". "View as list" shows every active container oldest first.
  Why now: Once matching works, the promise is "right unless you tap"; these fixes are what make a wrong link (like the banana-tub case) harmless. The list shares the same detail sheet, so it is built with it.
  PRD ref: `prd.md > Container Detail and One-Tap Fixes`, `prd.md > Unseen Shelf`, `prd.md > View as List`, `prd.md > The Core Journey` (steps 6-7)
  Spec ref: `spec.md > Container Detail`, `spec.md > Same-Container Picker`, `spec.md > Unseen Shelf`, `spec.md > List View`, `spec.md > Data Model`
  Build: `refill`, `split`, `merge`, `stillThere`, `remove` in `lib/actions.ts`, each writing its event in the same transaction; `ContainerSheet`, `pick/page.tsx`, `ContainerList`, shelf buttons.
  Verify (mechanical): `npm run build` passes; a browser run on the two-photo fridge: Refilled makes the age "today" and adds a `refilled` event; split creates a new container dated to the photo; merge gives the current container the picked one's date and deletes the other; Removed takes it off shelf and list; the list order equals `dateStart` ascending.
  Learner check: Find a container the app linked wrongly (or pick any) and fix it with "This is a new container"; join two that should be one with "same as…"; tap "Refilled" on one; mark a shelf item "Removed". Then open "View as list" and check the oldest is on top.
  Commit: `Add container detail, one-tap fixes, shelf actions, and list view`

- [x] **5. Timelines show everything that happened, per container and per fridge**
  Becomes usable: From Container Detail, a Container Timeline of every crop with its time and every action; from each fridge card on the Fridge List, a Fridge Timeline of photos and every container action in that fridge only.
  Why now: Timelines only read what slices 2-4 write, so they come once every event type exists.
  PRD ref: `prd.md > Timelines`
  Spec ref: `spec.md > Timelines`, `spec.md > Data Model` (events)
  Build: `Timeline` component; `timeline/page.tsx` and `containers/[containerId]/timeline/page.tsx`; the timeline button on `FridgeCard`.
  Verify (mechanical): `npm run build` passes; after the slice-4 run, the container timeline lists added, refilled, split/merged, removed with times, newest first; a second fridge's timeline shows none of the first fridge's entries.
  Learner check: Open the timeline of the container you refilled and the fridge timeline from the fridge card, and check that what you did is all there with the right times.
  Commit: `Add container and fridge timelines`

- [x] **6. Anyone can try it from a live link on a phone, including a sample fridge that needs no API calls**
  Becomes usable: A production URL on Vercel that works on the learner's iPhone (HTTPS camera, Home Screen install with persistent storage), a "Try the sample fridge" card on the Fridge List that loads the learner's real fridge history and lets anyone add the next day's photo and watch the matching scene (reminders, then pins, the lid-only container found) replayed from a saved result, a pointer to the sample fridge when live matching hits the daily quota, a README on how to run, deploy, and evaluate, and an MIT license.
  Why now: The real-phone checks (does the iPhone keep the photo's date, does storage persist) can only happen here, the sample data must come from real runs of the finished app, and the demo and judges need the live link a day before submission.
  PRD ref: `prd.md > States and Boundaries` (what persists), `prd.md > Adding a Photo and Its Date`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Important Failure Modes` (timestamp, iPhone data), `spec.md > Verify early in the build`
  Build: sample fridge (export a real fridge's photos and rows to `public/sample/`, photos re-encoded without EXIF and with brand labels blurred; import on demand; its "Add photo" replays the saved next-day result through the same apply step); quota-exhausted message in Photo Check pointing to the sample fridge; web app manifest + icon, `navigator.storage.persist()`, `maxDuration` on both routes, README, LICENSE; deploy with the `vercel` CLI and set `GEMINI_API_KEY` as a Vercel environment variable (with the learner's go-ahead at that moment).
  Verify (mechanical): `npm run build` passes; with `GEMINI_API_KEY` unset, the sample fridge loads, its add-photo step replays matching and shows pins, and no request reaches `/api/*`; the published sample photos carry no EXIF (checked with exifr); the production URL returns 200; a `POST /api/match` with a real photo against production returns containers; the key does not appear in the client bundle or the repo.
  Learner check: Open the sample fridge as a judge would and add its next-day photo; then open the link on your iPhone, add it to the Home Screen, upload a photo from your camera roll and tell me whether the date it shows is the day you took it; take one live too.
  Commit: `Add sample fridge, manifest, persistent storage, README, license, and deploy config`

- [ ] **7. The match rate is measured once on held-out photos**
  Becomes usable: The reported match rate: correct links, misses, and wrong links on the 10/24 → 10/25 and 10/25 → 10/26 pairs, measured once with the frozen prompts and model, saved in `eval/results/` and summarized in the README.
  Why now: It must come after all prompt tuning is frozen and after the held-out photos exist; measuring earlier would leak the test into the tuning.
  PRD ref: `prd.md > Deferred From the POC` (showing the match rate: test first, then decide)
  Spec ref: `spec.md > Evaluation Harness`, `spec.md > The learner's useful unknown`
  Build: Draft the two answer keys (one matcher run, numbered boxes, the learner confirms or corrects each), run the evaluation once, write the result into the README.
  Verify (mechanical): the run exits 0, prints both pair tables and totals, and the git log shows no change to `server/gemini.ts` between the freeze commit and this run.
  Learner check: Confirm each numbered box in the two answer keys, then read the final table and decide whether the number goes into the demo video.
  Commit: `Measure match rate on held-out photos`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 3 (the core loop on your real 10/22 → 10/23 photos, including the lid-only container)
  Feedback: "Everything looks good" (tried the 10/22 and 10/23 photos and the blurry photo). Requested change: move the real photos folder into the project folder — done, gitignored.
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: 
Route and stops: 
Edit outcome: 
Reflection: 
Activity mode: 

## Revisions

- Removed the Flash-Lite fallback; a busy model now gets one retry, then "busy, try again" with nothing saved — on the tuning pair 3.5 Flash-Lite copied the previous boxes and linked 18 of 23 containers wrongly (7/23 correct), which would silently hand containers other containers' dates.
- Primary model stays `gemini-3.6-flash` (learner decision) — `gemini-3.8-flash` was the most accurate in its one clean run (20/23, 0 wrong links) but hit 504s and 90-second timeouts in all three runs and took about 3 minutes; 3.6 Flash answered in 11–20 s with 19–20/23 and 1–2 wrong links.
- Added a sample fridge with replayed matching (slice 6) and a development record/replay cache (slice 2), learner decision to stay on the free tier — the free tier allows 20 requests per day per model for `gemini-3.6-flash` (2 per photo), which can't cover tuning, testing, the demo, and judges trying the live URL.
- Known containers now carry their short description, step-2 targets carry their previous box (a size sanity check), and step-2 finds that overlap a claimed box are dropped — the first runs returned a box already claimed by another container and one box half a shelf wide.
- Added `lib/boxes.ts` (box math and the step-1 + step-2 merge, shared by the phone and the eval) and `sharp` as a dev dependency for the eval's image preparation — so the eval measures the same merge the app ships.
- Prompt tuning continues after the slice-1 commit within the daily quota, as separate commits; prompts are frozen before slice 7 — the learner chose to tune, and the quota ran out mid-session.
- Turned off `cacheComponents` in `next.config.ts`, added `dexie-react-hooks` (live queries so pins re-render after every change), gave both routes `maxDuration = 120`, and send Gemini short aliases (c1, c2, …) for stored container IDs — every screen is a client page reading IndexedDB (Cache Components would only demand Suspense around `useParams`), and a retry after a 40 s timeout can pass 60 s.
- A failed step 2 (search) no longer fails the whole photo: step 1's result is saved and the containers it missed go to the Unseen Shelf — step 1 alone is still a correct, useful result, and failing it would waste the quota already spent.
- "Same as…" keeps the sighting the user just fixed when both containers were seen on the same photo (the other one's sighting on that photo is dropped), and shelf items' detail sheet offers Still there / Removed instead of split / same-as — a merge could otherwise leave two pins for one container, and a container not on the latest photo has no sighting to split.
- Prompts frozen at the baseline after tuning on the 10/22 → 10/23 pair; tried and reverted: A, telling step 2 where each target used to be (2 runs: 20/23 correct, 2.0 wrong links per run) and B, adding A plus per-container crops to step 1 (2 runs: 20.5/23, 2.5 wrong links per run), against the baseline's 19–20/23 and about 1.0 wrong link per run over 5 runs — neither found the hidden c1 or c25, and run-to-run spread (0–2 wrong links) was larger than any gain; learner approved the freeze.
- The sample fridge's `sample.json` was built from a saved real eval run (`eval/results/2026-10-24T05-46-01-558Z.json`, run 0, 3.6 Flash, baseline prompts) instead of `scripts/make-sample.ts`, because the daily quota was used up; the photos themselves come from `make-sample.ts` (shrunk, EXIF stripped, brand regions blurred). The chosen run includes the hidden white tub found by search and one wrong link — kept as an honest example. Added a `scripts/` folder for it.
- `vercel link` appended `.vercel` and `.env*` to `.gitignore`; the `.env*` line was removed again so `!.env.example` still applies (`.env.local` stays ignored by `.env.*`). Deployed to https://leftover-clock.vercel.app; the key is in no client chunk or tracked file, and the real photos folder is not served (404).
- Slice 6's "`POST /api/match` against production returns containers" check is deferred: the free tier's 20 daily requests were used up on 10/24 (resets 16:00 KST). It runs first thing in slice 7, before the held-out measurement; everything else in slice 6's verification passed.
- Learner feedback after slice 6 (10/25): a crop alone doesn't show which container it is, so "Same as…" now offers every earlier full photo (newest first, one date button each) with the photo view as the default; the crop list stays as the second option.
- Learner feedback after slice 6 (10/25): the large blur rectangles made the sample look worse and spilled into container crops. Since the rules bar third-party trademarks from the demo video, the learner chose to keep blurring but only the printed brand names and logos: small soft-edged patches (`scripts/make-sample.ts`, new `--photos-only` mode that keeps `sample.json`). The one crop still showing a soft patch is a store-bought jar the matcher counted as a container.
- Learner feedback (10/25, on the reset sample with only its first photo): "This is a new container" left the age unchanged and "Same as…" fell back to the crop list. On a fridge's first photo every container is already dated from that photo, so these fixes did nothing. The detail sheet now shows Refilled / new container only when the container's date is older than the latest photo, "Same as…" only when an earlier photo exists, and otherwise a one-line note that fixes appear after the next photo.
