export function CategoryChips({ categories, selected, onSelect }) {
  const options = [{ slug: '', name: 'All' }, ...categories];
  return (
    <div className="chips" role="group" aria-label="Filter by category">
      {options.map((category) => (
        <button
          key={category.slug || 'all'}
          type="button"
          className="chip"
          aria-pressed={selected === category.slug}
          onClick={() => onSelect(category.slug)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
