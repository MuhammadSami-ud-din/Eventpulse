// A wide table scrolls sideways inside this box on small screens. Being
// focusable (tabIndex 0) lets keyboard users scroll it with the arrow keys,
// even when the table holds no links or buttons; the label names the region.
export function TableWrap({ label, busy, children }) {
  return (
    <div className="table-wrap" role="region" aria-label={label} aria-busy={busy} tabIndex={0}>
      {children}
    </div>
  );
}
