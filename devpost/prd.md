---
doc: prd
status: approved
---

# Leftover Clock — Product Requirements

A mobile web app that tells the learner how old each home-leftover container in their fridge is, from fridge photos alone: no typing or labeling of containers.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`, `scope.md > The POC Boundary`.

## The Core Journey
Develops `scope.md > The Core Loop`.

1. **Open the app → Fridge List.** A round, cute screen showing every fridge as a card with its image (a chosen fridge illustration or the user's own photo) and its name. Each fridge also has a button that opens its **Fridge Timeline** right from the list.
2. **Tap a fridge → Fridge View.** The fridge's latest photo fills the screen like a map, with a pin on every container the app sees. Below the photo, the **Unseen Shelf** holds containers that weren't visible in that photo.
3. **Add a photo.** Either take one in the app or upload an existing one. The photo's date and time are filled in automatically (capture time, the photo's stored timestamp, or the current time as a fallback), and the user can change them before continuing.
4. **Wait for matching → Reminders.** While the app matches containers against earlier photos, it shows easy-to-read reminders drawn from this fridge's history, e.g. "These are your oldest containers." If the photo can't be read, the app walks the user through a short photo check and a retake (see **Photo Can't Be Read**).
5. **See the result.** Pins appear on the new photo, each with a short, non-overlapping tooltip showing the container's age. Matched containers keep their date; newly seen ones start at the photo's date. Containers that weren't found go to the Unseen Shelf.
6. **Fix anything wrong with one tap.** Tap a pin to see its recent history and the fix buttons ("Refilled", "This is a new container", "This is the same container as…"). On the shelf, each container has "Still there" / "Removed".
7. **Check the ages.** "View as list" shows every container oldest first. Success: one glance tells the learner which leftovers are oldest, including one they couldn't spot in the photo themselves (`scope.md > What "Working" Looks Like`).

## Screens and Layout

- **Fridge List** (start screen): fridge cards (image + name), each with a button to its Fridge Timeline, and an "Add fridge" action.
- **Add Fridge:** type a name; pick a fridge illustration from a set, or set your own photo as the fridge image.
- **Fridge View:** latest photo with pins on top; the Unseen Shelf directly below; actions for "Add photo" and "View as list".
- **Add Photo:** take a photo or upload one; confirm or change its date and time; start matching.
- **Matching (reminders):** shown while matching runs; reminders, then it hands off to the Fridge View with the new pins.
- **Photo Check:** shown when the photo can't be read; a few check prompts, then retake or upload another.
- **Container Detail:** opened by tapping a pin, a shelf item, or a list row.
- **Pick the Same Container:** opened from "This is the same container as…"; pick from pins on an earlier photo, or switch to a list of crops.
- **List View:** every container in this fridge, oldest first.
- **Container Timeline** and **Fridge Timeline.**

## Look and Feel
Develops `scope.md > Inspiration & Identity`.

- **Fridge View (map-style):** clean and tidy, like a map app. The photo is the focus; pins and tooltips are small, legible, and never overlap.
- **Every other screen** (Fridge List, Add Fridge, list, timelines, detail): round and cute, in the spirit of Cooking Mama — rounded shapes, friendly illustrations (the fridge illustrations live here).
- UI language: English.

## Features and Behavior

### Fridges
Develops `scope.md > The POC Boundary` ("Multiple fridges").
- The user can add several fridges, each with a typed name and an image: one of the provided fridge illustrations, or their own photo.
- Each fridge keeps its own photos, containers, and history.
  - [ ] Adding two fridges with different names and images shows two distinct cards on the Fridge List.
  - [ ] Choosing an illustration and choosing an own photo both work and show on the card.
  - [ ] Photos and containers added to one fridge never appear in the other.

### Adding a Photo and Its Date
Develops `scope.md > What the Date Means` and `scope.md > The POC Boundary` ("Add dated fridge photos").
- A photo taken in the app gets its capture time.
- An uploaded photo gets the timestamp stored in the photo, if it has one; otherwise the current time.
- Before matching starts, the user sees the photo's date and time and can change them.
  - [ ] Uploading a real fridge photo from an earlier day shows that day's date and time, taken from the photo.
  - [ ] Uploading a photo with no stored timestamp shows the current time.
  - [ ] Changing the date/time before continuing makes that the photo's date everywhere (ages, timeline).

### Reminders While Matching
- While matching runs, the screen shows reminders drawn from the fridge's and containers' history, written to be read at a glance. Examples from the learner: "These are your oldest containers." / "You refill these often, but it's been a while since their last refill."
  - [ ] With history present, at least one reminder appears during matching and names real containers from this fridge (e.g. shows their crops).
  - [ ] With no useful history (first photo), the waiting screen still shows something sensible rather than an empty space.

### Photo Can't Be Read
- When matching finds no containers or fails, the app assumes the photo may be the problem. Like an ID-card scanner, it shows a few check prompts (e.g. "Is the photo blurry?") and asks the user to retake the photo or upload a different one.
- If it still fails after that, the app accepts it: the technology isn't good enough for that photo. **Assumption (low stakes):** the app says plainly that it couldn't read the photo, the photo isn't added, and the fridge's containers and dates stay as they were.
  - [ ] A deliberately blurry photo leads to the check prompts and a retake/upload choice, not a crash or an empty map.
  - [ ] A good photo taken after the retake goes through matching as usual.
  - [ ] A failed photo leaves the existing pins, list, and dates unchanged.

### Matching and Pins
Develops `scope.md > The Unique Kernel` and `scope.md > The Core Loop`.
- The app matches each container in the new photo to containers seen in earlier photos, even if it moved or is partly hidden (the lid-only case).
- A matched container keeps its date. A container with no match becomes a new container dated to the photo.
- The app does not guess refills: matching is its whole job. Refills, removals, and corrections come from the user's taps.
- Each container gets a pin on the latest photo with a short tooltip showing its age. Tooltips are laid out so they never overlap.
- The first photo of a fridge treats every container as a new container automatically, with no questions asked: they're being registered for the first time.
  - [ ] On a real photo from a later day, containers seen before show their original age, not 0 days.
  - [ ] A container pushed to the back with only its lid showing gets a pin and keeps its original date.
  - [ ] No two tooltips overlap on the demo photos.

### Container Detail and One-Tap Fixes
Develops `scope.md > The POC Boundary` ("Correct a mistake with one tap", "One-tap Refilled").
- Tapping a pin opens the container's detail: its crop, its age and date, and its few most recent history entries.
- **Refilled:** resets the date to the photo's date and keeps the container and its history.
- **This is a new container:** splits it off as a new container dated to this photo.
- **This is the same container as…:** opens the picker. By default it shows pins on the most recent earlier photo where the container is clearly visible; a button switches to a list of crops instead. Picking one merges them, and the container takes that one's date and history.
  - [ ] Each fix is one tap on its button (plus one pick for "same as…"), and the pin's age updates right away.
  - [ ] After "Refilled", the age reads 0 days (or the photo's age), and the history shows a "Refilled" entry.
  - [ ] After "same as…", the container shows the picked container's original date.

### Unseen Shelf
- Below the photo, a virtual fridge shelf holds only the containers that weren't found in the latest photo.
- Each shows its clearest earlier crop; if none is clear, a default image.
- Each has two buttons: **Still there** (keeps its place in the list and its dates; it shows up as usual) and **Removed** (it leaves this fridge's current containers; the removal goes in the history).
  - [ ] A container missing from the latest photo appears on the shelf with its clearest crop.
  - [ ] "Still there" keeps its date and it still appears in the list.
  - [ ] "Removed" takes it off the shelf and out of the list, and the timeline shows the removal.

### View as List
Develops `scope.md > Inspiration & Identity` ("view as list").
- A button switches the Fridge View to a list of every current container, oldest first: crop, age, and date. Tapping a row opens the same Container Detail.
  - [ ] The list order matches the ages on the pins, oldest at the top.
  - [ ] Containers marked "Still there" appear in the list with their dates.

### Timelines
Develops `scope.md > The POC Boundary` ("Timeline for each container and for the whole fridge").
- **Container Timeline** (from Container Detail): every crop of this container with date and time, and every action — added, refilled, corrected, still there, removed, and so on.
- **Fridge Timeline** (from each fridge's button on the Fridge List): everything that happened in that fridge — photos and every container's actions — opened without going into the fridge first.
  - [ ] After a demo run (several photos, one refill, one correction, one removal), the container timeline shows each of those with its date and time.
  - [ ] Each fridge's timeline button on the Fridge List opens that fridge's history, and it shows only that fridge's entries.

## States and Boundaries

- **No fridges yet** — the Fridge List shows only an inviting "Add fridge".
- **Fridge with no photos** — the Fridge View invites the user to add the first photo instead of showing an empty map.
- **First photo** — every container becomes a new container; nothing is on the shelf.
- **Photo without a timestamp** — the current time is used, and the user can change it.
- **No containers found / matching fails** — photo check prompts, then retake or upload another; if it still fails, nothing changes (see **Photo Can't Be Read**).
- **What persists** — fridges, photos, containers, dates, and history stay on the learner's phone between visits. No account.

## Product Decisions

- The app matches; the user decides — no automatic refill inference. A container that disappears and comes back is not assumed refilled; the user taps a button when something changed.
- Matching results apply automatically; corrections take one tap — keeps the "no typing" promise and makes the demo "right unless you tap".
- Missing containers go to a visible Unseen Shelf with "Still there" / "Removed" — mirrors the buttons for newly seen containers.
- Photo date: capture time → stored timestamp → current time, always changeable before matching — the demo depends on real photos from different days.
- Fridge names are typed — the "no typing" rule is about containers, not fridges.
- Two visual tones: a clean map for the Fridge View, round and cute (Cooking Mama) everywhere else.
- Fridge illustrations / own fridge photo and the reminders are in now; Settings and editing event times are later.
- Each fridge's timeline opens from a button on the Fridge List — going into every fridge to see its history would be a hassle.
- First photo = all new containers — they're being registered for the first time; otherwise the user would have to set every first-seen time.
- A photo that can't be read gets an ID-scanner-style check and a retake; if it still fails, the app doesn't try to work around it.

## What We're Building
- Several fridges, each with a typed name and an illustration or own photo
- Add a photo (camera or upload) with an automatic, changeable date and time
- Reminders while matching
- Photo check and retake when a photo can't be read
- Automatic matching across photos, including the lid-only case; dates kept on match
- Pins with non-overlapping age tooltips on the latest photo
- Container Detail with recent history and one-tap fixes: Refilled / This is a new container / This is the same container as… (pin picker + crop list)
- Unseen Shelf with Still there / Removed
- View as list, oldest first
- Container Timeline, and a Fridge Timeline for each fridge opened from the Fridge List
- English UI

## Deferred From the POC
- **Settings screen and choosing the start screen** (fridge list vs. a specific fridge) — convenience, not part of proving photo dating.
- **Editing the time of any event** (added, refilled, removed…) and **editing several at once** — the photo's date covers the demo; per-event editing is more screens.
- **Uploading your own image for a shelf item** — crops and a default image are enough for now.
- **Showing the match rate in the demo** — `scope.md > Later`: test first, then decide.

## Possible Later Enhancements
- Smarter reminders once there's more history.
- A per-fridge choice of what counts as "old" for highlighting.

## Non-Goals
- No typing or labeling of containers — the core promise.
- No guessing what's inside a container — the camera can't see inside opaque containers.
- No automatic refill detection — the user taps "Refilled".
- No login, accounts, or multiple users — `scope.md > Explicitly Cut`.
- No "throw this out" notifications — `scope.md > Explicitly Cut`.

## Open Questions
- **"Same as…" picker photo:** the default photo is "the most recent earlier photo where the container is clearly visible". Which earlier photo shows is a detail the build can settle. *Can wait.*
- **Shelf items left untouched:** a container on the shelf that gets neither button — assumed to stay in the list with its date, the same as "Still there", until the user taps or it's seen again. *Can wait.*
