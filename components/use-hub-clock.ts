"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}
const snapshot = () => Math.floor(Date.now() / 30_000);
const serverSnapshot = () => null;

/** A shared clock with an empty server snapshot to avoid hydration differences. */
export function useHubClock() {
  const tick = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return tick === null ? null : new Date(tick * 30_000);
}
