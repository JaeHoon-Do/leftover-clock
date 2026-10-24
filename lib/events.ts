import type { FridgeEvent } from "./db";

const TEXT: Record<FridgeEvent["type"], string> = {
  photo_added: "Photo added",
  added: "First seen",
  refilled: "Refilled",
  split: "Split",
  merged: "Joined",
  still_there: "Marked still there",
  removed: "Removed",
};

export function eventText(e: FridgeEvent): string {
  return e.detail ?? TEXT[e.type];
}
