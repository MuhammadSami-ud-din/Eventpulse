import { useState } from 'react';
import { fieldErrors } from '../utils/errors.js';
import { validateForm } from '../utils/validation.js';

// Form state with client-side validation that never moves the layout under
// the user's cursor:
// - nothing is flagged until the first submit attempt;
// - after that, errors update on every keystroke, so a fixed field clears at once.
// (Validating on blur shows an error the moment the user clicks "Submit", which
// pushes the button down and swallows the click.)
export function useForm(initialValues, schema) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    const next = { ...values, [e.target.name]: e.target.value };
    setValues(next);
    // All fields, not just this one: "confirm password" depends on "password".
    if (attempted) setErrors(validateForm(next, schema));
  }

  // Validates, then runs `submit(values)`. Server-side field errors are shown
  // on their fields; the error is re-thrown so the caller can show a message.
  async function submitWith(submit) {
    setAttempted(true);
    const clientErrors = validateForm(values, schema);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return false;

    setSubmitting(true);
    try {
      await submit(values);
      return true;
    } catch (error) {
      setErrors(fieldErrors(error));
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  function reset(nextValues = initialValues) {
    setValues(nextValues);
    setErrors({});
    setAttempted(false);
  }

  const field = (name) => ({ name, value: values[name], onChange: handleChange, error: errors[name] });

  return { values, field, submitWith, submitting, reset };
}
