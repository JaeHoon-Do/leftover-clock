---
doc: scope
status: approved
---

# Leftover Clock

A mobile web app that tells you how old each home-leftover container in your fridge is, from fridge photos alone: no typing, no labels.

## The Unique Kernel
Packaged food has a printed date; home food in opaque lidded containers doesn't. Leftover Clock gives each container a "first seen" date just by matching it across everyday fridge photos, even after it's been moved or pushed behind something, and catches containers a person glancing at the photo would miss.

## What the Date Means
The date is when the food now in the container went in, not when the container first showed up.
- Topping up: the date of the new batch. The learner moves the old food to the top so it gets eaten first.
- Throwing it out and refilling the same container: also the new date.
The camera can't see inside an opaque container, and a refilled container usually "looks like it never left its spot," so a refill is one tap: **"Refilled."** It resets the date and keeps the container.
Open for the PRD: should a container that's missing from one photo and back in the next count as refilled? Sometimes it's just out while someone eats from it.

## Who It's For
The learner, at home. They put leftovers in opaque containers, open one days later, wonder "when did I make this?", sniff it, and often throw the whole thing out. Today there's nothing to go on but memory and smell.

## The Core Loop
Open the fridge → take one photo → the app matches every container to earlier photos and pins each one on the new photo with its age. Tap a pin for details, or switch to the list to see everything oldest first. They come back because the dates only exist if the photos keep coming, and checking them takes one glance.

## Inspiration & Identity
A map app. Pins sit on the fridge photo, each with a short tooltip, laid out so they don't overlap; tapping a pin opens full details. Like a map's "view as list" button, a list view shows every container sorted oldest first, for when the photo gets crowded. The UI is in English.

## Why This Matters to the Learner
It's their own fridge and their own thrown-out food. Their learning goal: "How to test whether a vision model can recognize the same opaque container across photos, and measure that honestly as a match rate." The big question for them is "will this actually work well?", with containers moved, added, and half hidden.

## What "Working" Looks Like
In a short demo, using the learner's real fridge photos taken on different days: the latest photo shows a pin on each container with its age, the list sorts them oldest first, and a fix takes one tap when the app gets one wrong.
The "oh, that's cool" beat: a container pushed to the back, with only its lid showing, which the learner themselves couldn't spot at first. The app finds it and keeps its original date. "If the app can find things like that, things a person glancing at the photo would miss, I'd call it a success."
Match rate: test first, then decide. If the numbers are surprisingly good, show them briefly.

## The POC Boundary
- Add dated fridge photos (the learner's real photos)
- Match containers across photos automatically; remember each container's first-seen date
- Find partly hidden containers (the lid-only case)
- Pins with non-overlapping short tooltips on the latest photo; tap a pin for details
- "View as list," oldest first
- Correct a mistake with one tap: "This is a new container" / "This is the same container as…"
- One-tap "Refilled" when the contents change (resets the date, keeps the container)
- Timeline for each container and for the whole fridge: photo crops, date and time, and every action (new container added, refilled, corrected, and so on)
- Multiple fridges: the learner thinks it's cheap to build and worth having
- English UI
- Sample fridge with a replayed matching scene, so judges can try it without using the free daily quota (added in the build, learner decision)

## Later
- Showing the match rate in the demo: decide after testing

## Explicitly Cut
- Login and accounts: a single person on their own phone doesn't need them
- Multiple users: same reason; the learner is the user
- "Throw this out" notifications: not needed to prove that photos alone can date a container
