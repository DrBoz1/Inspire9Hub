/** An inline share-of-capacity bar. Decorative: the percentage is always printed beside it. */
export function Meter({ fraction }: { fraction: number | null }) {
  const width = fraction === null ? 0 : Math.round(Math.min(1, Math.max(0, fraction)) * 1000) / 10;
  return (
    <span className="admin-meter" data-empty={fraction === null || undefined} aria-hidden>
      <span style={{ width: `${width}%` }} />
    </span>
  );
}
