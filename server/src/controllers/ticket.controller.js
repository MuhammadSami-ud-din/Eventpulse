import { getTicketStatus } from '../services/ticket.service.js';

export async function getTicket(req, res) {
  res.json({ ticket: await getTicketStatus(req.validated.params.code) });
}
