import * as eventManagement from '../services/eventManagement.service.js';
import { csvFileName, exportRegistrationsCsv, getEventStats } from '../services/eventStats.service.js';
import { listEventRegistrations as queryEventRegistrations } from '../services/registrationQueries.service.js';
import { withTimeFlags } from '../utils/eventTiming.js';

const eventId = (req) => req.validated.params.id;
const respond = (res, event, status = 200) => res.status(status).json({ event: withTimeFlags(event) });

export async function listMyEvents(req, res) {
  const { data, pagination } = await eventManagement.listManagedEvents(req.user, req.validated.query);
  const now = Date.now();
  res.json({ data: data.map((event) => withTimeFlags(event, now)), pagination });
}

export async function getMyEvent(req, res) {
  respond(res, await eventManagement.getManagedEvent(req.user, eventId(req)));
}

export async function createEvent(req, res) {
  respond(res, await eventManagement.createEvent(req.user, req.validated.body), 201);
}

export async function updateEvent(req, res) {
  respond(res, await eventManagement.updateEvent(req.user, eventId(req), req.validated.body));
}

export async function deleteEvent(req, res) {
  await eventManagement.deleteEvent(req.user, eventId(req));
  res.status(204).end();
}

export async function publishEvent(req, res) {
  respond(res, await eventManagement.publishEvent(req.user, eventId(req)));
}

export async function closeEvent(req, res) {
  respond(res, await eventManagement.closeEvent(req.user, eventId(req)));
}

export async function listEventRegistrations(req, res) {
  const event = await eventManagement.getManagedEvent(req.user, eventId(req));
  res.json(await queryEventRegistrations(event.id, req.validated.query));
}

export async function getStats(req, res) {
  const event = await eventManagement.getManagedEvent(req.user, eventId(req));
  res.json({ stats: await getEventStats(event, req.validated.query) });
}

export async function exportRegistrations(req, res) {
  const event = await eventManagement.getManagedEvent(req.user, eventId(req));
  res
    .type('text/csv; charset=utf-8')
    .attachment(csvFileName(event))
    .send(await exportRegistrationsCsv(event));
}
