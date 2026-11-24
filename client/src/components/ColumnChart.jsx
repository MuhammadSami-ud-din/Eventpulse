import { pluralize } from '../utils/format.js';

// Vertical bars for counts over time. `columns` arrive in order with no gaps:
// [{ key, label, tick, count }]. `label` names a column in its tooltip and in
// the table view; `tick` is the text under it ('' leaves it unlabelled).
export function ColumnChart({ title, columns, columnHeading, unit, emptyMessage }) {
  const max = Math.max(0, ...columns.map((column) => column.count));
  if (max === 0) return <p className="chart__empty">{emptyMessage}</p>;
  const unitHeading = `${unit[0].toUpperCase()}${unit.slice(1)}s`;

  return (
    <figure className="chart">
      <figcaption className="chart__title">{title}</figcaption>
      <div className="column-chart" aria-hidden="true">
        <span className="column-chart__max">{max}</span>
        <div className="column-chart__plot">
          {columns.map((column) => (
            <div key={column.key} className="column-chart__column" data-tip={`${column.label}: ${pluralize(column.count, unit)}`}>
              <div className="column-chart__bar" style={{ height: `${(column.count / max) * 100}%` }} />
            </div>
          ))}
        </div>
        {/* Same column layout as the plot, so each label sits under its bar. */}
        <div className="column-chart__axis">
          {columns.map((column) => (
            <span key={column.key} className="column-chart__tick">
              {column.tick}
            </span>
          ))}
        </div>
      </div>
      <details className="chart__table">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{columnHeading}</th>
              <th scope="col">{unitHeading}</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.key}>
                <td>{column.label}</td>
                <td>{column.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
