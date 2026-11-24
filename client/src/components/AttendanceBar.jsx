import { pluralize } from '../utils/format.js';

// One stacked bar of the confirmed seats: attended, no-show, and the rest
// (not marked yet), which is left as the empty track rather than a third colour.
// Colours come from --series-1/--series-2, checked for colour-blind separation.
export function AttendanceBar({ stats }) {
  const { confirmed, attended, noShows, notMarked } = stats;
  if (confirmed === 0) return <p className="chart__empty">No confirmed registrations yet.</p>;

  const segments = [
    { key: 'attended', label: 'Attended', count: attended },
    { key: 'no-show', label: 'No-show', count: noShows },
  ];
  const percent = (count) => `${(count / confirmed) * 100}%`;

  return (
    <figure className="chart">
      <figcaption className="chart__title">Attendance of {pluralize(confirmed, 'confirmed seat')}</figcaption>
      <div className="stacked-bar" aria-hidden="true">
        {segments
          .filter((segment) => segment.count > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className={`stacked-bar__segment stacked-bar__segment--${segment.key}`}
              style={{ width: percent(segment.count) }}
              data-tip={`${segment.label}: ${segment.count}`}
            />
          ))}
      </div>
      {/* The legend carries the numbers too, so nothing depends on colour or hover. */}
      <ul className="legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <span className={`legend__swatch legend__swatch--${segment.key}`} aria-hidden="true" />
            {segment.label} <strong>{segment.count}</strong>
          </li>
        ))}
        <li>
          <span className="legend__swatch legend__swatch--track" aria-hidden="true" />
          Not marked <strong>{notMarked}</strong>
        </li>
      </ul>
    </figure>
  );
}
