import { barPercent } from "@/lib/admin-insights";

export type BarItem = { key: string; label: string; value: number; display: string };

/**
 * A short ranked list of horizontal bars, one hue, value printed at the tip.
 * Every value is labelled, so there's nothing to hover for.
 */
export function BarList({ label, items }: { label: string; items: BarItem[] }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <ul className="admin-barlist" aria-label={label}>
      {items.map((item) => (
        <li key={item.key}>
          <span className="admin-barlist-label">{item.label}</span>
          <span className="admin-barlist-track" aria-hidden>
            <span style={{ width: `${barPercent(item.value, max)}%` }} />
          </span>
          <span className="admin-barlist-value">{item.display}</span>
        </li>
      ))}
    </ul>
  );
}
