import { formatDate, formatShortDate } from '../utils/format.js';
import { ColumnChart } from './ColumnChart.jsx';

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
const atNoon = (date) => `${date}T12:00:00`;

export function RegistrationsChart({ days }) {
  const series = fillMissingDays(days);
  // Only the first and last days are labelled, so labels never collide.
  const isEnd = (index) => index === 0 || index === series.length - 1;
  const columns = series.map((day, index) => ({
    key: day.date,
    label: formatDate(atNoon(day.date)),
    tick: isEnd(index) ? formatShortDate(atNoon(day.date)) : '',
    count: day.count,
  }));
  return (
    <ColumnChart
      title="Registrations per day"
      columns={columns}
      columnHeading="Day"
      unit="registration"
      emptyMessage="No registrations yet."
    />
  );
}
