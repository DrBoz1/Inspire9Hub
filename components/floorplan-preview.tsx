import { WALLS } from "@/features/booking-map/floorplan/plan";
import { SPACES } from "@/features/booking-map/data/spaces";
import { pathFor } from "@/features/booking-map/floorplan/shapes";

/** A small preview of the same geometry used by the interactive map. */
export function FloorplanPreview() {
  return <svg viewBox="60 60 2110 1360" fill="none" aria-hidden="true" className="hub-plan-preview">
    <rect x="105" y="105" width="2012" height="1263" fill="currentColor" opacity=".035" />
    {SPACES.filter(s => s.bookable).map(s => <path key={s.id} d={pathFor(s.shape)} fill="currentColor" fillOpacity={s.group === "rooms" ? .18 : .07} stroke="currentColor" strokeOpacity=".2" strokeWidth="4" />)}
    {WALLS.map((wall, i) => <line key={i} x1={wall.l[0]} y1={wall.l[1]} x2={wall.l[2]} y2={wall.l[3]} stroke="currentColor" strokeOpacity=".55" strokeWidth={wall.c === "perimeter" ? 15 : 7} />)}
  </svg>;
}
