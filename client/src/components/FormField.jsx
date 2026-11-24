import { useId } from 'react';

// Label, input, hint and error wired together with ids so screen readers
// read the hint and the error along with the field.
export function FormField({ label, error, hint, as: Control = 'input', children, ...inputProps }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <Control
        id={id}
        className="field__control"
        aria-invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...inputProps}
      >
        {children}
      </Control>
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
