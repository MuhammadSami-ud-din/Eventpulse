import { useEffect, useRef, useState } from 'react';
import { fieldErrors } from '../utils/errors.js';
import { validateForm } from '../utils/validation.js';

// Form state with client-side validation that never moves the layout under
// the user's cursor:
// - nothing is flagged until the first submit attempt;
// - after that, errors update on every keystroke, so a fixed field clears at once.
// (Validating on blur shows an error the moment the user clicks "Submit", which
// pushes the button down and swallows the click.)
// A failed submit moves focus to the first invalid field, so keyboard and
// screen-reader users land on the problem and hear its error message.
export function useForm(initialValues, schema) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef({});
  const [focusRequest, setFocusRequest] = useState(null);

  // Runs after the render that shows the errors, so the field is already
  // marked invalid (and described by its error) when it receives focus.
  useEffect(() => {
    if (focusRequest) inputs.current[focusRequest.field]?.focus();
  }, [focusRequest]);

  // Field order in `values` is the order on screen.
  function focusFirstError(errorsByField) {
    const field = Object.keys(values).find((name) => errorsByField[name]);
    // A new object each time, so a second failed submit focuses again.
    if (field) setFocusRequest({ field });
  }

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
    if (Object.keys(clientErrors).length) {
      focusFirstError(clientErrors);
      return false;
    }

    setSubmitting(true);
    try {
      await submit(values);
      return true;
    } catch (error) {
      const serverErrors = fieldErrors(error);
      setErrors(serverErrors);
      focusFirstError(serverErrors);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  // For inputs that are not plain form controls, such as a list of agenda items.
  function setValue(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    if (attempted) setErrors(validateForm(next, schema));
  }

  function reset(nextValues = initialValues) {
    setValues(nextValues);
    setErrors({});
    setAttempted(false);
  }

  // `ref` reaches the <input> through FormField's props (React 19 passes refs as props).
  const field = (name) => ({
    name,
    value: values[name],
    onChange: handleChange,
    error: errors[name],
    ref: (element) => {
      inputs.current[name] = element;
    },
  });

  return { values, errors, field, setValue, submitWith, submitting, reset };
}
