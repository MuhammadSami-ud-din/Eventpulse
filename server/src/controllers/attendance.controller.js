import * as attendanceService from '../services/attendance.service.js';
import { getManagedEvent } from '../services/eventManagement.service.js';

const managedEvent = (req) => getManagedEvent(req.user, req.validated.params.id);

export async function checkIn(req, res) {
  res.json(await attendanceService.checkIn(req.user, await managedEvent(req), req.validated.body.code));
}

export async function markAttendance(req, res) {
  const { registrationId } = req.validated.params;
  const attendance = await attendanceService.markAttendance(
    req.user,
    await managedEvent(req),
    registrationId,
    req.validated.body.status,
  );
  res.json({ attendance });
}

export async function markRemainingNoShows(req, res) {
  res.json(await attendanceService.markRemainingNoShows(req.user, await managedEvent(req)));
}
