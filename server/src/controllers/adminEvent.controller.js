import * as eventManagement from '../services/eventManagement.service.js';
import { withTimeFlags } from '../utils/eventTiming.js';

export async function approveEvent(req, res) {
  const event = await eventManagement.approveEvent(req.user, req.validated.params.id);
  res.json({ event: withTimeFlags(event) });
}

export async function rejectEvent(req, res) {
  const event = await eventManagement.rejectEvent(req.user, req.validated.params.id, req.validated.body.reason);
  res.json({ event: withTimeFlags(event) });
}
