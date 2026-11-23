const HOUR_MS = 60 * 60 * 1000;

export function cancellationDeadline(event) {
  return new Date(event.startsAt.getTime() - event.cancellationWindowHours * HOUR_MS);
}

export function hasStarted(event, now = Date.now()) {
  return now >= event.startsAt.getTime();
}

export function isRegistrationOpen(event, now = Date.now()) {
  return event.status === 'published' && now < event.registrationDeadline.getTime() && !hasStarted(event, now);
}

export function isCancellationOpen(event, now = Date.now()) {
  return now < cancellationDeadline(event).getTime();
}

// Time-dependent fields are added when a response is sent, never cached,
// so a cached event cannot claim registration is open after the deadline.
export function withTimeFlags(event, now = Date.now()) {
  return {
    ...event,
    cancellationDeadline: cancellationDeadline(event),
    registrationOpen: isRegistrationOpen(event, now),
    cancellationOpen: isCancellationOpen(event, now),
    isPast: now >= event.endsAt.getTime(),
  };
}
