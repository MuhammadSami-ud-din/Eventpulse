import * as registrationQueries from '../services/registrationQueries.service.js';
import * as registrationService from '../services/registration.service.js';

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
