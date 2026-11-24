import { pluralize } from './format.js';

// One student-facing summary of whether (and how) they can still join an event.
export function eventAvailability(event) {
  if (event.isPast) return { label: 'Ended', tone: 'neutral' };
  if (event.status === 'closed') return { label: 'Registration closed', tone: 'neutral' };
  if (!event.registrationOpen) return { label: 'Registration closed', tone: 'neutral' };
  if (event.seatsLeft === 0) return { label: 'Full · waitlist open', tone: 'warning' };
  if (event.seatsLeft <= Math.max(3, Math.ceil(event.capacity * 0.1))) {
    return { label: `Only ${pluralize(event.seatsLeft, 'seat')} left`, tone: 'warning' };
  }
  return { label: 'Open', tone: 'success' };
}

export const REGISTRATION_STATUS = {
  confirmed: { label: 'Confirmed', tone: 'success' },
  waitlisted: { label: 'Waitlisted', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

export const ATTENDANCE_STATUS = {
  attended: { label: 'Attended', tone: 'success' },
  no_show: { label: 'No-show', tone: 'danger' },
};

// Lifecycle status, as organizers and admins see it.
export const EVENT_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending approval', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  closed: { label: 'Registration closed', tone: 'neutral' },
};

export const hasEventStarted = (event) => Date.now() >= new Date(event.startsAt).getTime();
