"use client";
import { useEffect } from "react";

/**
 * Ask the browser to keep this site's IndexedDB. Safari still clears it after 7 days without a
 * visit unless the app is added to the Home Screen (README).
 */
export function PersistStorage() {
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  return null;
}
