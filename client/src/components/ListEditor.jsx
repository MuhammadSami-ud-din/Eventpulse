import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon.jsx';

// Edits a list of small records (agenda items, speakers) as rows of inputs.
//   fields: [{ key, label, type?, maxLength?, size? }] describe one row.
// Each input has a visible label plus a hidden "(agenda item 2)", so screen
// readers know which row it belongs to. Adding a row moves focus into it.
export function ListEditor({ legend, hint, items, fields, emptyItem, max, addLabel, itemName, error, fieldsetRef, onChange }) {
  const baseId = useId();
  const errorId = `${baseId}-error`;
  const listRef = useRef(null);
  const previousLength = useRef(items.length);

  useEffect(() => {
    if (items.length > previousLength.current) {
      listRef.current?.querySelector('li:last-child input')?.focus();
    }
    previousLength.current = items.length;
  }, [items.length]);

  const update = (index, key, value) => onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    // tabIndex -1: a failed submit can move focus here to announce the error.
    <fieldset ref={fieldsetRef} tabIndex={-1} className="list-editor" aria-describedby={error ? errorId : undefined}>
      <legend className="field__label">{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      {items.length > 0 && (
        <ol className="list-editor__items" ref={listRef}>
          {items.map((item, index) => (
            <li key={index} className="list-editor__row">
              {fields.map((field) => {
                const id = `${baseId}-${index}-${field.key}`;
                return (
                  <div key={field.key} className={`list-editor__field list-editor__field--${field.size ?? 'md'}`}>
                    <label htmlFor={id} className="list-editor__label">
                      {field.label}
                      <span className="visually-hidden">
                        {' '}
                        ({itemName} {index + 1})
                      </span>
                    </label>
                    <input
                      id={id}
                      className="field__control"
                      type={field.type ?? 'text'}
                      maxLength={field.maxLength}
                      value={item[field.key]}
                      onChange={(e) => update(index, field.key, e.target.value)}
                    />
                  </div>
                );
              })}
              <button type="button" className="icon-button list-editor__remove" onClick={() => remove(index)}>
                <Icon name="close" size={18} />
                <span className="visually-hidden">
                  Remove {itemName} {index + 1}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
      <button
        type="button"
        className="button button--small"
        onClick={() => onChange([...items, { ...emptyItem }])}
        disabled={items.length >= max}
      >
        <Icon name="plus" size={16} />
        {addLabel}
      </button>
      {items.length >= max && <p className="field__hint">That is the maximum ({max}).</p>}
    </fieldset>
  );
}
