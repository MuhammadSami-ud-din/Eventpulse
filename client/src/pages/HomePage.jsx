import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { fetchCategories, fetchEvents } from '../api/events.js';
import { CategoryChips } from '../components/CategoryChips.jsx';
import { EventCard } from '../components/EventCard.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { CardListSkeleton } from '../components/Skeletons.jsx';
import { EmptyState, ErrorState } from '../components/StateViews.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { pluralize } from '../utils/format.js';

const SORT_OPTIONS = [
  { value: 'date', label: 'Soonest first' },
  { value: 'popular', label: 'Most popular' },
  { value: 'newest', label: 'Newly added' },
];
const PAGE_SIZE = 12;

// Date inputs give local calendar days; the API wants exact instants.
const startOfDay = (day) => new Date(`${day}T00:00:00`).toISOString();
const endOfDay = (day) => new Date(`${day}T23:59:59.999`).toISOString();

// Filters live in the URL, so a filtered list can be shared, bookmarked and
// restored with the back button.
function readFilters(params) {
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    sort: params.get('sort') ?? 'date',
    page: Number(params.get('page')) || 1,
  };
}

function toApiParams(filters) {
  return {
    q: filters.q || undefined,
    category: filters.category || undefined,
    from: filters.from ? startOfDay(filters.from) : undefined,
    to: filters.to ? endOfDay(filters.to) : undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

export function HomePage() {
  useDocumentTitle('Events');
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const [searchText, setSearchText] = useState(filters.q);
  const debouncedSearch = useDebouncedValue(searchText.trim());
  const dateRangeInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);

  function updateFilters(changes) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change starts again from page 1.
    if (!('page' in changes)) next.delete('page');
    // Typing should not add a history entry per keystroke.
    setParams(next, { replace: 'q' in changes });
  }

  // Typing -> URL (after the debounce).
  useEffect(() => {
    if (debouncedSearch !== filters.q) updateFilters({ q: debouncedSearch });
  }, [debouncedSearch]);

  // URL -> search box, when it changes from outside (Back button, a shared link).
  useEffect(() => {
    if (filters.q !== debouncedSearch) setSearchText(filters.q);
  }, [filters.q]);

  const categories = useAsync((signal) => fetchCategories({ signal }), []);
  const events = useAsync(
    (signal) => (dateRangeInvalid ? Promise.resolve(null) : fetchEvents(toApiParams(filters), { signal })),
    [params.toString()],
  );

  const hasFilters = Boolean(filters.q || filters.category || filters.from || filters.to);
  function clearFilters() {
    setSearchText('');
    setParams(new URLSearchParams());
  }

  return (
    <>
      <section className="hero">
        <h1 className="hero__title">What’s happening on campus</h1>
        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="event-search" className="visually-hidden">
            Search events
          </label>
          <input
            id="event-search"
            type="search"
            className="search__input"
            placeholder="Search events, venues…"
            value={searchText}
            maxLength={100}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </form>
      </section>

      <section className="filters" aria-label="Filters">
        {categories.data && (
          <CategoryChips
            categories={categories.data}
            selected={filters.category}
            onSelect={(category) => updateFilters({ category })}
          />
        )}
        <div className="filters__row">
          <div className="field field--inline">
            <label htmlFor="filter-from" className="field__label">
              From
            </label>
            <input
              id="filter-from"
              type="date"
              className="field__control"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => updateFilters({ from: e.target.value })}
            />
          </div>
          <div className="field field--inline">
            <label htmlFor="filter-to" className="field__label">
              To
            </label>
            <input
              id="filter-to"
              type="date"
              className="field__control"
              value={filters.to}
              min={filters.from || undefined}
              aria-invalid={dateRangeInvalid}
              aria-describedby={dateRangeInvalid ? 'date-range-error' : undefined}
              onChange={(e) => updateFilters({ to: e.target.value })}
            />
          </div>
          <div className="field field--inline">
            <label htmlFor="filter-sort" className="field__label">
              Sort by
            </label>
            <select
              id="filter-sort"
              className="field__control"
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button type="button" className="button button--ghost" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
        {dateRangeInvalid && (
          <p id="date-range-error" className="field__error">
            The “To” date must be on or after the “From” date.
          </p>
        )}
      </section>

      <section aria-labelledby="results-heading" aria-busy={events.isFetching}>
        <h2 id="results-heading" className="visually-hidden">
          Events
        </h2>
        <EventResults events={events} hasFilters={hasFilters} onClear={clearFilters} onPageChange={(page) => updateFilters({ page: String(page) })} />
      </section>
    </>
  );
}

function EventResults({ events, hasFilters, onClear, onPageChange }) {
  if (events.isLoading) return <CardListSkeleton label="Loading events…" className="event-grid" />;
  if (events.error) return <ErrorState error={events.error} onRetry={events.reload} />;
  if (!events.data) return null;

  const { data, pagination } = events.data;
  if (data.length === 0) {
    return (
      <EmptyState
        title="No events found"
        message={hasFilters ? 'Try a different search or clear the filters.' : 'New events will appear here once they are announced.'}
        action={
          hasFilters && (
            <button type="button" className="button" onClick={onClear}>
              Clear filters
            </button>
          )
        }
      />
    );
  }
  return (
    <>
      <p className="results-count" role="status">
        {pluralize(pagination.total, 'event')} found
      </p>
      <div className="event-grid">
        {data.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
      <Pagination pagination={pagination} onPageChange={onPageChange} />
    </>
  );
}
