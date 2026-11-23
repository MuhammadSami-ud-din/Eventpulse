const TEMPLATES = {
  registration_confirmed: (title) => ({
    title: 'Registration confirmed',
    message: `Your seat for "${title}" is confirmed. Your ticket is in My Registrations.`,
  }),
  waitlisted: (title, position) => ({
    title: 'Added to waitlist',
    message: `"${title}" is full. You are #${position} on the waitlist and will be notified if a seat opens.`,
  }),
  promoted: (title) => ({
    title: 'You got a seat',
    message: `A seat opened up for "${title}" and you have been moved from the waitlist to confirmed.`,
  }),
  registration_cancelled: (title) => ({
    title: 'Registration cancelled',
    message: `Your registration for "${title}" has been cancelled.`,
  }),
  event_approved: (title) => ({
    title: 'Event approved',
    message: `"${title}" was approved and is now visible to students.`,
  }),
  event_rejected: (title, reason) => ({
    title: 'Event not approved',
    message: `"${title}" was not approved. Reason: ${reason}`,
  }),
};

export function buildNotification(type, eventTitle, detail) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);
  return { type, ...template(eventTitle, detail) };
}
