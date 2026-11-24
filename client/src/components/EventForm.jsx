import { useState } from 'react';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { EVENT_FORM_SCHEMA, toEventPayload } from '../utils/eventForm.js';
import { FormField } from './FormField.jsx';

export function EventForm({ initialValues, categories, submitLabel, onSubmit }) {
  const form = useForm(initialValues, EVENT_FORM_SCHEMA);
  const [formError, setFormError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      await form.submitWith((values) => onSubmit(toEventPayload(values)));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <form className="card event-form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <p className="form-error" role="alert">
          {formError}
        </p>
      )}
      <FormField label="Title" maxLength={150} {...form.field('title')} />
      <div className="event-form__row">
        <FormField label="Category" as="select" {...form.field('categoryId')}>
          <option value="">Choose a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </FormField>
        <FormField label="Venue" maxLength={150} {...form.field('venue')} />
      </div>
      <FormField label="Description" as="textarea" rows={6} maxLength={5000} {...form.field('description')} />
      <div className="event-form__row">
        <FormField label="Starts" type="datetime-local" {...form.field('startsAt')} />
        <FormField label="Ends" type="datetime-local" {...form.field('endsAt')} />
      </div>
      <FormField
        label="Registration closes"
        type="datetime-local"
        hint="Must be at or before the start time."
        {...form.field('registrationDeadline')}
      />
      <div className="event-form__row">
        <FormField label="Capacity" type="number" min={1} max={100000} inputMode="numeric" {...form.field('capacity')} />
        <FormField
          label="Cancellation window (hours)"
          type="number"
          min={0}
          max={720}
          inputMode="numeric"
          hint="Students can cancel until this many hours before the start."
          {...form.field('cancellationWindowHours')}
        />
      </div>
      <button type="submit" className="button button--primary" disabled={form.submitting}>
        {form.submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
