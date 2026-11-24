import { useRef, useState } from 'react';
import { checkInTicket } from '../../api/organizer.js';
import { ManagedEventGate } from '../../components/ManagedEventGate.jsx';
import { OrganizerEventHeader } from '../../components/OrganizerEventHeader.jsx';
import { QrScanner } from '../../components/QrScanner.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { errorCode, errorMessage } from '../../utils/errors.js';
import { formatDateTime, formatTime } from '../../utils/format.js';

// The camera reports the same QR on every frame while it is in view.
const REPEAT_SCAN_IGNORE_MS = 3000;
const RECENT_LIMIT = 8;
const CHECK_IN_OPENS_HOURS_BEFORE = 2;

const ERROR_TITLES = {
  TICKET_NOT_FOUND: 'Not a ticket for this event',
  TICKET_CANCELLED: 'Ticket cancelled',
  NOT_CONFIRMED: 'On the waitlist — no seat',
  VALIDATION_ERROR: 'Not an EventPulse ticket',
  CHECK_IN_CLOSED: 'Check-in is closed',
};

function toResult(response) {
  const { student } = response.registration;
  const who = `${student.fullName}${student.studentNumber ? ` · ${student.studentNumber}` : ''}`;
  if (response.result === 'checked_in') return { kind: 'success', title: 'Checked in', detail: who };
  return {
    kind: 'warning',
    title: 'Already checked in',
    detail: `${who} — at ${formatTime(response.attendance.checkedInAt)}. Check their ID if this is a second person.`,
  };
}

function toErrorResult(error) {
  return { kind: 'error', title: ERROR_TITLES[errorCode(error)] ?? 'Could not check in', detail: errorMessage(error) };
}

function windowNotice(event) {
  const opensAt = new Date(new Date(event.startsAt).getTime() - CHECK_IN_OPENS_HOURS_BEFORE * 60 * 60 * 1000);
  if (event.isPast) return 'This event has ended. Mark attendance from the Registrations tab instead.';
  if (Date.now() < opensAt.getTime()) return `Check-in opens at ${formatDateTime(opensAt)}.`;
  return null;
}

function CheckInDesk({ event }) {
  useDocumentTitle(`Check-in · ${event.title}`);
  const [code, setCode] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [result, setResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const inFlight = useRef(false);
  const lastScan = useRef({ text: '', at: 0 });
  const inputRef = useRef(null);

  async function submitCode(text) {
    if (inFlight.current) return false;
    inFlight.current = true;
    try {
      const outcome = toResult(await checkInTicket(event.id, text));
      setResult(outcome);
      setRecent((current) => [{ ...outcome, at: new Date() }, ...current].slice(0, RECENT_LIMIT));
      if (outcome.kind === 'success') navigator.vibrate?.(80);
      return true;
    } catch (error) {
      setResult(toErrorResult(error));
      return false;
    } finally {
      inFlight.current = false;
    }
  }

  function handleScan(text) {
    const now = Date.now();
    if (text === lastScan.current.text && now - lastScan.current.at < REPEAT_SCAN_IGNORE_MS) return;
    lastScan.current = { text, at: now };
    submitCode(text);
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    if (await submitCode(code)) setCode('');
    inputRef.current?.focus();
  }

  const notice = windowNotice(event);
  return (
    <div className="check-in">
      {notice && <p className="notice">{notice}</p>}

      <div className="check-in__grid">
        <section className="card" aria-labelledby="scan-heading">
          <h2 id="scan-heading">Scan a ticket</h2>
          {cameraOn ? (
            <>
              <QrScanner onScan={handleScan} />
              <button type="button" className="button" onClick={() => setCameraOn(false)}>
                Stop camera
              </button>
            </>
          ) : (
            <button type="button" className="button button--primary button--block" onClick={() => setCameraOn(true)}>
              Start camera
            </button>
          )}

          <form className="check-in__manual" onSubmit={handleManualSubmit}>
            <label htmlFor="ticket-code" className="field__label">
              Or type the ticket code
            </label>
            <div className="check-in__manual-row">
              <input
                ref={inputRef}
                id="ticket-code"
                className="field__control check-in__code-input"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCDE FGH23"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={100}
              />
              <button type="submit" className="button button--primary">
                Check in
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="result-heading">
          <h2 id="result-heading" className="visually-hidden">
            Result
          </h2>
          {/* Announced to screen readers; staff at a busy door may not be looking at the screen. */}
          <div className={`scan-result ${result ? `scan-result--${result.kind}` : ''}`} role="status" aria-live="assertive">
            {result ? (
              <>
                <p className="scan-result__title">{result.title}</p>
                <p className="scan-result__detail">{result.detail}</p>
              </>
            ) : (
              <p className="scan-result__detail">Scan or type a ticket code to check someone in.</p>
            )}
          </div>

          {recent.length > 0 && (
            <>
              <h3 className="check-in__recent-heading">Recent</h3>
              <ul className="recent-list">
                {recent.map((entry, index) => (
                  <li key={`${entry.at.getTime()}-${index}`} className={`recent-list__item recent-list__item--${entry.kind}`}>
                    <span>{entry.title}</span>
                    <span>{entry.detail}</span>
                    <time dateTime={entry.at.toISOString()}>{formatTime(entry.at)}</time>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export function CheckInPage() {
  return (
    <ManagedEventGate>
      {(event) => (
        <>
          <OrganizerEventHeader event={event} />
          <CheckInDesk event={event} />
        </>
      )}
    </ManagedEventGate>
  );
}
