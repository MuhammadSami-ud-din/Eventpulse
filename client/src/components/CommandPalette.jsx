import { useEffect, useState } from 'react';
import { fetchEvents } from '../api/events.js';
import { useAsync } from '../hooks/useAsync.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { filterCommands } from '../utils/commands.js';
import { formatDate } from '../utils/format.js';
import { Icon } from './Icon.jsx';
import { Modal } from './Modal.jsx';

const MIN_SEARCH_LENGTH = 2;
const optionId = (index) => `palette-option-${index}`;

const noEvents = () => Promise.resolve([]);

// Splits the flat result list into runs of the same group, keeping each
// result's position in the flat list (which is what the arrow keys move through).
function groupResults(results) {
  const groups = [];
  results.forEach((result, index) => {
    const last = groups.at(-1);
    if (last?.label === result.group) last.items.push({ result, index });
    else groups.push({ label: result.group, items: [{ result, index }] });
  });
  return groups;
}

// A combobox: focus stays in the text box while Up/Down move the highlighted
// option (aria-activedescendant), Enter runs it, Escape closes the dialog.
function PaletteBody({ commands, onRun }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const search = useDebouncedValue(query.trim());

  const events = useAsync(
    (signal) =>
      search.length >= MIN_SEARCH_LENGTH
        ? fetchEvents({ q: search, pageSize: 5 }, { signal }).then((page) => page.data)
        : noEvents(),
    [search],
  );

  const eventResults = (search.length >= MIN_SEARCH_LENGTH ? events.data ?? [] : []).map((event) => ({
    id: `event:${event.id}`,
    group: 'Events',
    label: event.title,
    detail: formatDate(event.startsAt),
    icon: 'calendar',
    to: `/events/${event.id}`,
  }));
  const results = [...filterCommands(commands, query), ...eventResults];
  const activeIndex = Math.min(active, results.length - 1);

  useEffect(() => {
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function handleKeyDown(e) {
    if (results.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((activeIndex + step + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onRun(results[activeIndex]);
    }
  }

  const searching = events.isFetching && query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <div className="palette">
      <div className="palette__search">
        <Icon name="search" />
        <input
          className="palette__input"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={results.length ? optionId(activeIndex) : undefined}
          aria-label="Search pages, events and actions"
          placeholder="Search pages, events and actions…"
          value={query}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <ul id="palette-list" className="palette__list" role="listbox" aria-label="Results">
        {groupResults(results).map((group) => (
          <li key={group.label} role="presentation">
            <p className="palette__group" id={`palette-group-${group.label}`} role="presentation">
              {group.label}
            </p>
            <ul role="group" aria-labelledby={`palette-group-${group.label}`}>
              {group.items.map(({ result, index }) => (
                <li
                  key={result.id}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  className="palette__option"
                  onMouseMove={() => setActive(index)}
                  onClick={() => onRun(result)}
                >
                  <Icon name={result.icon} />
                  <span className="palette__label">{result.label}</span>
                  {result.detail && <span className="palette__detail">{result.detail}</span>}
                  <Icon name="arrowRight" className="palette__enter" />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="palette__status" role="status">
        {searching
          ? 'Searching events…'
          : results.length === 0
            ? `Nothing matches “${query.trim()}”`
            : `${results.length} result${results.length === 1 ? '' : 's'}`}
      </p>
    </div>
  );
}

export function CommandPalette({ open, onClose, commands, onRun }) {
  return (
    <Modal open={open} onClose={onClose} label="Command palette" className="modal--palette">
      <PaletteBody commands={commands} onRun={onRun} />
    </Modal>
  );
}
