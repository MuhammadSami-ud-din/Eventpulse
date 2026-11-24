import { useState } from 'react';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { DETAIL_LIMITS, EMPTY_AGENDA_ITEM, EMPTY_SPEAKER, EVENT_FORM_SCHEMA, parseTags, toEventPayload } from '../utils/eventForm.js';
import { EventHero, EventSections } from './EventDetails.jsx';
import { FormField } from './FormField.jsx';
import { ListEditor } from './ListEditor.jsx';

const AGENDA_FIELDS = [
  { key: 'time', label: 'Time', type: 'time', size: 'sm' },
  { key: 'title', label: 'What happens', maxLength: 120, size: 'lg' },
  { key: 'details', label: 'Details (optional)', maxLength: 300, size: 'lg' },
];
const SPEAKER_FIELDS = [
  { key: 'name', label: 'Name', maxLength: 100, size: 'lg' },
  { key: 'role', label: 'Role (optional)', maxLength: 100, size: 'lg' },
];

const FORMATTING_HINT = 'Formatting: **bold**, *italic*, [link text](https://…), and lines starting with "- " for a list.';

// "2026-12-01T14:00" -> an ISO date, or null while the field is empty or incomplete.
function localToIso(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

// The event as it would look with what is typed so far, for the live preview.
function previewEvent(values, categories, context) {
  return {
    id: context.eventId ?? 'new',
    title: values.title.trim() || 'Untitled event',
    tagline: values.tagline.trim(),
    description: values.description,
    venue: values.venue.trim(),
    startsAt: localToIso(values.startsAt),
    endsAt: localToIso(values.endsAt),
    category: categories.find((category) => String(category.id) === values.categoryId) ?? null,
    organizer: context.organizer,
    coverUrl: context.coverUrl ?? null,
    agenda: values.agenda.filter((item) => item.time || item.title.trim()),
    speakers: values.speakers.filter((speaker) => speaker.name.trim()),
    tags: parseTags(values.tags),
    whatToBring: values.whatToBring.trim(),
    entryNotes: values.entryNotes.trim(),
    contact: values.contact.trim(),
  };
}

// `previewContext`: { eventId?, coverUrl?, organizer: { id, name, avatarUrl } }.
export function EventForm({ initialValues, categories, submitLabel, onSubmit, previewContext }) {
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
    <div className="editor">
      <form className="card event-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <section className="event-form__section" aria-labelledby="basics-heading">
          <h2 id="basics-heading" className="event-form__heading">
            Basics
          </h2>
          <FormField label="Title" maxLength={150} {...form.field('title')} />
          <FormField
            label="Tagline (optional)"
            maxLength={160}
            hint="One line shown under the title, e.g. “Build something real in 24 hours”."
            {...form.field('tagline')}
          />
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
          <FormField label="Description" as="textarea" rows={8} maxLength={5000} hint={FORMATTING_HINT} {...form.field('description')} />
        </section>

        <section className="event-form__section" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="event-form__heading">
            Schedule and seats
          </h2>
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
        </section>

        <section className="event-form__section" aria-labelledby="details-heading">
          <h2 id="details-heading" className="event-form__heading">
            Event page details (optional)
          </h2>
          <ListEditor
            legend="Agenda"
            hint="24-hour times, e.g. 14:30."
            items={form.values.agenda}
            fields={AGENDA_FIELDS}
            emptyItem={EMPTY_AGENDA_ITEM}
            max={DETAIL_LIMITS.agendaItems}
            addLabel="Add agenda item"
            itemName="agenda item"
            error={form.errors.agenda}
            fieldsetRef={form.field('agenda').ref}
            onChange={(items) => form.setValue('agenda', items)}
          />
          <ListEditor
            legend="Speakers and hosts"
            items={form.values.speakers}
            fields={SPEAKER_FIELDS}
            emptyItem={EMPTY_SPEAKER}
            max={DETAIL_LIMITS.speakers}
            addLabel="Add speaker or host"
            itemName="speaker"
            error={form.errors.speakers}
            fieldsetRef={form.field('speakers').ref}
            onChange={(items) => form.setValue('speakers', items)}
          />
          <FormField label="Tags" hint={`Separate with commas, up to ${DETAIL_LIMITS.tags}, e.g. coding, teamwork.`} {...form.field('tags')} />
          <FormField label="What to bring" as="textarea" rows={3} maxLength={500} {...form.field('whatToBring')} />
          <FormField label="Dress code and entry notes" as="textarea" rows={3} maxLength={500} {...form.field('entryNotes')} />
          <FormField label="Contact" maxLength={255} hint="An email address, a web address or a name." {...form.field('contact')} />
        </section>

        <button type="submit" className="button button--primary" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : submitLabel}
        </button>
      </form>

      <aside className="editor__preview" aria-labelledby="preview-heading">
        <h2 id="preview-heading" className="editor__preview-title">
          Live preview
        </h2>
        <p className="field__hint">This is how students will see the event page.</p>
        <div className="card preview">
          <EventHero event={previewEvent(form.values, categories, previewContext)} level={3} />
          <EventSections event={previewEvent(form.values, categories, previewContext)} level={4} />
        </div>
      </aside>
    </div>
  );
}
