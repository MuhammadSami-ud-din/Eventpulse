import { formatRate } from '../utils/format.js';

// One bar per category: the share of its seats that are taken. The text next
// to each bar carries the exact numbers, so the bars themselves are decorative.
export function CategoryDemand({ categories }) {
  return (
    <figure className="chart">
      <figcaption className="chart__title">Seats taken by category</figcaption>
      <ul className="bar-list">
        {categories.map((category) => (
          <li key={category.id} className="bar-list__item">
            <div className="bar-list__label">
              <span>{category.name}</span>
              <span className="bar-list__value">
                {category.seats === 0
                  ? 'No public events'
                  : `${category.confirmed} / ${category.seats} seats · ${formatRate(category.confirmed / category.seats)}`}
              </span>
            </div>
            <div className="bar-list__track" aria-hidden="true">
              {category.confirmed > 0 && (
                <div className="bar-list__fill" style={{ width: `${(category.confirmed / category.seats) * 100}%` }} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
