import * as registrationQueries from '../services/registrationQueries.service.js';
import * as registrationService from '../services/registration.service.js';
import { renderTicketQr } from '../services/ticket.service.js';
import { HttpError } from '../utils/HttpError.js';

export async function register(req, res) {
  const registration = await registrationService.register(req.user, req.validated.params.id);
  res.status(201).json({ registration });
}

export async function listMine(req, res) {
  res.json({ data: await registrationQueries.listMyRegistrations(req.user.id, req.validated.query) });
}

export async function getMine(req, res) {
  const registration = await registrationQueries.getRegistrationForUser(req.user.id, req.validated.params.id);
  res.json({ registration });
}

export async function cancelMine(req, res) {
  const registration = await registrationService.cancel(req.user, req.validated.params.id);
  res.json({ registration });
}

export async function getTicketQr(req, res) {
  const registration = await registrationQueries.getRegistrationForUser(req.user.id, req.validated.params.id);
  if (!registration.ticketCode) {
    throw new HttpError(409, 'NO_TICKET', 'Only confirmed registrations have a ticket');
  }
  res
    .type('png')
    .set('Content-Disposition', `inline; filename="eventpulse-ticket-${registration.id}.png"`)
    .send(await renderTicketQr(registration.ticketCode));
}
