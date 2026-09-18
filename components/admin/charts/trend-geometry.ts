/**
 * The coordinate space trend lines are drawn in. Lives outside the "use client"
 * chart so the server, which computes the paths, gets the real numbers: a server
 * component importing a value from a client module gets a reference, not the value.
 */
export const TREND_VIEWBOX = { width: 1000, height: 180 } as const;
