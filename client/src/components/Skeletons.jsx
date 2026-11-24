// Placeholders in the shape of the content that is loading. Screen readers
// hear only the label (role="status"); the shapes themselves are hidden.

const Bone = ({ className = '' }) => <span className={`skeleton ${className}`} />;

const times = (count) => Array.from({ length: count }, (_, index) => index);

function SkeletonRegion({ label, children }) {
  return (
    <div role="status">
      <span className="visually-hidden">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

// `className` is the real list's class (e.g. "event-grid"), so the placeholder
// cards land in exactly the same columns as the cards that replace them.
// `cover` adds the image area that event cards have.
export function CardListSkeleton({ label, count = 6, className, cover = false }) {
  return (
    <SkeletonRegion label={label}>
      <div className={className}>
        {times(count).map((index) => (
          <div key={index} className={`card skeleton-card ${cover ? 'skeleton-card--cover' : ''}`}>
            {cover && <Bone className="skeleton--cover" />}
            <div className="skeleton-card__body">
              <Bone className="skeleton--chip" />
              <Bone className="skeleton--title" />
              <Bone />
              <Bone className="skeleton--short" />
              <Bone className="skeleton--bar" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function TableSkeleton({ label, rows = 6, columns = 4 }) {
  return (
    <SkeletonRegion label={label}>
      <div className="table-wrap">
        {times(rows).map((row) => (
          <div key={row} className="skeleton-row" style={{ '--columns': columns }}>
            {times(columns).map((column) => (
              <Bone key={column} className={column === 0 ? '' : 'skeleton--short'} />
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

// A page about one thing: heading, a few lines, and a large panel.
export function DetailSkeleton({ label }) {
  return (
    <SkeletonRegion label={label}>
      <Bone className="skeleton--heading" />
      <Bone className="skeleton--short" />
      <div className="card skeleton-panel">
        <Bone className="skeleton--title" />
        <Bone />
        <Bone />
        <Bone className="skeleton--short" />
      </div>
    </SkeletonRegion>
  );
}

// Stat tiles over two panels, like the event stats and analytics pages.
export function DashboardSkeleton({ label, tiles = 6 }) {
  return (
    <SkeletonRegion label={label}>
      <div className="stat-grid">
        {times(tiles).map((index) => (
          <div key={index} className="stat-tile">
            <Bone className="skeleton--short" />
            <Bone className="skeleton--value" />
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="card">
          <Bone className="skeleton--title" />
          <Bone className="skeleton--block" />
        </div>
        <div className="card">
          <Bone className="skeleton--title" />
          <Bone className="skeleton--block" />
        </div>
      </div>
    </SkeletonRegion>
  );
}
