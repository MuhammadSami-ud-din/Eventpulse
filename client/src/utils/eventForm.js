import { fromLocalInputValue, toLocalInputValue } from './dateInput.js';
import { rules } from './validation.js';

export const EMPTY_EVENT_FORM = {
  title: '',
  categoryId: '',
  venue: '',
  description: '',
  startsAt: '',
  endsAt: '',
  registrationDeadline: '',
  capacity: '',
  cancellationWindowHours: '24',
};

const time = (value) => new Date(value).getTime();

const integerBetween = (min, max, label) => (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? null
    : `${label} must be a whole number from ${min} to ${max}`;
};

const lengthBetween = (min, max, label) => (value) => {
  const length = value.trim().length;
  if (length < min) return `${label} must be at least ${min} characters`;
  return length > max ? `${label} must be at most ${max} characters` : null;
};

// Mirrors the server's scheduleIssues(): the server repeats every check.
export const EVENT_FORM_SCHEMA = {
  title: [rules.required('Title'), lengthBetween(3, 150, 'Title')],
  categoryId: [rules.required('Category')],
  venue: [rules.required('Venue'), lengthBetween(2, 150, 'Venue')],
  description: [rules.required('Description'), lengthBetween(10, 5000, 'Description')],
  startsAt: [rules.required('Start time'), (value) => (time(value) > Date.now() ? null : 'Start time must be in the future')],
  endsAt: [
    rules.required('End time'),
    (value, values) => (time(value) > time(values.startsAt) ? null : 'End time must be after the start time'),
  ],
  registrationDeadline: [
    rules.required('Registration deadline'),
    (value, values) =>
      time(value) <= time(values.startsAt) ? null : 'Registration must close before the event starts',
  ],
  capacity: [rules.required('Capacity'), integerBetween(1, 100000, 'Capacity')],
  cancellationWindowHours: [rules.required('Cancellation window'), integerBetween(0, 720, 'Cancellation window')],
};

export function toEventFormValues(event) {
  return {
    title: event.title,
    categoryId: String(event.category.id),
    venue: event.venue,
    description: event.description,
    startsAt: toLocalInputValue(event.startsAt),
    endsAt: toLocalInputValue(event.endsAt),
    registrationDeadline: toLocalInputValue(event.registrationDeadline),
    capacity: String(event.capacity),
    cancellationWindowHours: String(event.cancellationWindowHours),
  };
}

export function toEventPayload(values) {
  return {
    title: values.title.trim(),
    categoryId: Number(values.categoryId),
    venue: values.venue.trim(),
    description: values.description.trim(),
    startsAt: fromLocalInputValue(values.startsAt),
    endsAt: fromLocalInputValue(values.endsAt),
    registrationDeadline: fromLocalInputValue(values.registrationDeadline),
    capacity: Number(values.capacity),
    cancellationWindowHours: Number(values.cancellationWindowHours),
  };
}
