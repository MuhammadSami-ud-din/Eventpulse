import { formatDate, formatShortDate, pluralize } from '../utils/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// The API only returns days that had registrations; the chart needs every day
// in between (as zero) so the time axis is not distorted.
function fillMissingDays(days) {
  if (days.length === 0) return [];
  const counts = new Map(days.map((day) => [day.date, day.count]));
  const filled = [];
  const last = Date.parse(`${days.at(-1).date}T00:00:00Z`);
  for (let t = Date.parse(`${days[0].date}T00:00:00Z`); t <= last; t += DAY_MS) {
    const date = new Date(t).toISOString().slice(0, 10);
    filled.push({ date, count: counts.get(date) ?? 0 });
  }
  return filled;
}

// Noon avoids the date shifting to the previous day when formatted in a time zone west of UTC.
const formatDay = (date) => formatDate(`${date}T12:00:00`);

export function RegistrationsChart({ days }) {
  const series = fillMissingDays(days);
  if (series.length === 0) return <p className="chart__empty">No registrations yet.</p>;
  const max = Math.max(...series.map((day) => day.count));

  return (
    <figure className="chart">
      <figcaption className="chart__title">Registrations per day</figcaption>
      <div className="column-chart" aria-hidden="true">
        <span className="column-chart__max">{max}</span>
        <div className="column-chart__plot">
          {series.map((day) => (
            <div
              key={day.date}
              className="column-chart__column"
              data-tip={`${formatDay(day.date)}: ${pluralize(day.count, 'registration')}`}
            >
              <div className="column-chart__bar" style={{ height: `${(day.count / max) * 100}%` }} />
            </div>
          ))}
        </div>
        {/* Same column layout as the plot, so each label sits under its bar.
            Only the first and last days are labelled to avoid collisions. */}
        <div className="column-chart__axis">
          {series.map((day, index) => (
            <span key={day.date} className="column-chart__tick">
              {index === 0 || index === series.length - 1 ? formatShortDate(`${day.date}T12:00:00`) : ''}
            </span>
          ))}
        </div>
      </div>
      <details className="chart__table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Registrations</th>
            </tr>
          </thead>
          <tbody>
            {series.map((day) => (
              <tr key={day.date}>
                <td>{formatDay(day.date)}</td>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
