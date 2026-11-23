import { getPublicEvent, listPublicEvents } from '../services/event.service.js';
import { withTimeFlags } from '../utils/eventTiming.js';
import { HttpError } from '../utils/HttpError.js';

export async function listEvents(req, res) {
  const { data, pagination } = await listPublicEvents(req.validated.query);
  const now = Date.now();
  res.json({ data: data.map((event) => withTimeFlags(event, now)), pagination });
}

export async function getEvent(req, res) {
  const event = await getPublicEvent(req.validated.params.id);
  if (!event) throw new HttpError(404, 'EVENT_NOT_FOUND', 'Event not found');
  res.json({ event: withTimeFlags(event) });
}
