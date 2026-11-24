# EventPulse

A campus event registration platform. Students find events and register for a seat (or join a waitlist when it is full) and get a QR ticket. Organizers run their events and check people in at the door. Admins approve events and manage users and categories.

## Contents

- [Roles](#roles)
- [Tech stack](#tech-stack)
- [How concurrency is handled](#how-concurrency-is-handled)
- [Business rules](#business-rules)
- [Database schema](#database-schema)
- [Setup](#setup)
- [Test accounts](#test-accounts)
- [Running the tests](#running-the-tests)
- [API reference](#api-reference)
- [Security notes](#security-notes)
- [Deployment](#deployment)
- [Screenshots](#screenshots)
- [Project structure](#project-structure)
- [Development notes](#development-notes)

## Roles

| Role | Can do |
|---|---|
| **Student** | Sign up; browse, search and filter events; register (a seat if one is free, otherwise the waitlist); cancel; view and download QR tickets; add events to a calendar (`.ics`); read notifications; manage their profile (photo, details, password) and see their activity. |
| **Organizer** | Create, edit, submit, close, reopen and delete their own events, with a cover image, tagline, formatted description, agenda, speakers, tags and entry notes (with a live preview); view per-event stats; search, filter and export registrations as CSV; check students in by camera scan or typed code; mark attendance and no-shows. |
| **Admin** | Everything an organizer can do, for every event; approve or reject submitted events (with a reason); create organizer and admin accounts; change roles; disable and re-enable accounts; manage categories; view platform analytics. |

Anyone can open a public ticket-status page at `/t/<code>` (this is what a phone's camera opens when the QR code contains a link). It shows the ticket's status and event, never the holder's details.

**Keyboard:** Ctrl+K (⌘K on a Mac) opens a command palette to jump to pages, search events, switch theme or log out; `/` focuses the page's search box; `?` lists every shortcut.

## Tech stack

- **Client:** React 19 with Vite, React Router, Axios, plain CSS (light and dark themes).
- **Server:** Node.js 22+ and Express 5, MySQL 8.0.19+ through `mysql2` with raw, parameterised SQL.
- **Auth:** JWT access and refresh tokens in httpOnly, `SameSite=Strict` cookies; refresh tokens are stored, rotated on every use, and revocable.
- **CSRF:** double-submit cookie (`X-CSRF-Token` header must match the cookie).
- **Validation:** zod schemas on every route that takes input, mirrored by client-side checks.
- **Other:** helmet (security headers and Content-Security-Policy), express-rate-limit, lru-cache, qrcode, bcrypt.
- **Tests:** Node's built-in test runner (`node:test`).

## How concurrency is handled

Seats are a shared resource: when one seat is left and many students click at the same moment, exactly one may get it.

- **Registering** runs in a transaction that first locks the event row with `SELECT … FOR UPDATE`. Every registration and cancellation for that event waits on the same lock, so "count the free seats, then take one" cannot interleave. The seat counter (`confirmed_count`) is only changed while that lock is held.
- **One lock order everywhere** (event row first, then registration rows) keeps transactions from deadlocking.
- **The database enforces the rules too**, so even a buggy code path cannot break them:
  - `CHECK (confirmed_count <= capacity)` makes overbooking impossible.
  - A unique key on `(event_id, user_id, active_marker)`, where `active_marker` is a generated column that is `NULL` for cancelled rows, allows one active registration per student per event. A student can still register again after cancelling.
- **Waitlist promotion happens in the same transaction as the cancellation.** If promoting the next student fails, the cancellation rolls back too, so a seat is never left empty while someone is waiting. Raising an event's capacity promotes waitlisted students in the same way.
- **Check-in** locks the registration row (`FOR UPDATE OF r`) before writing attendance, so twenty simultaneous scans of one ticket produce exactly one check-in and nineteen "already checked in" answers.
- **Admin role changes** lock both admins' rows in id order, so two admins demoting each other at the same moment cannot both succeed.

**The proof:** `server/tests/registration.test.js` fires 25 registrations for a 1-seat event at once. It checks that exactly 1 is confirmed and 24 are waitlisted at positions 1–24 with no duplicates. Before firing, the test opens every database connection (`warmUpDatabasePool`) so the requests really overlap. With the lock removed, the test fails. The same file sends 10 parallel requests from one student (1 succeeds, 9 get `ALREADY_REGISTERED`), and `attendance.test.js` fires 20 simultaneous check-ins for one ticket.

## Business rules

- **One active registration per student per event.** Registering again while confirmed or waitlisted returns `409 ALREADY_REGISTERED`.
- **Registration is open** only while the event is published, before its registration deadline, and before it starts. The deadline must be at or before the start time.
- **Full events** put new students on the waitlist, first come, first served. A freed seat goes to the first person waiting, who is notified and gets a ticket.
- **The cancellation window applies to confirmed seats only.** A confirmed student can cancel until *N* hours before the start, where *N* is set per event (0–720, default 24).
- **Waitlisted students can leave the waitlist at any time until the event starts.** It frees no seat, so it does not affect the organizer's planning.
- **A checked-in student can no longer cancel**, even if the cancellation window is 0 hours.
- **Check-in opens 2 hours before the start** and closes when the event ends. Only confirmed registrations can be checked in.
- **Attendance:** a student can be marked "no-show" only after the event has started. Once it has ended, the organizer can mark every remaining confirmed student as a no-show in one action.
- **Event approval:**
  - An organizer's event goes from draft to pending to published or rejected; a rejection needs a reason.
  - Editing a rejected event turns it back into a draft.
  - An admin's own events skip the approval queue.
  - A closed event can be reopened without another review.
- **Editing:** an event cannot be edited after it starts, and its capacity cannot drop below the number of confirmed seats.
- **Deleting:** only draft, pending or rejected events can be deleted. A published event has to be closed instead.
- **Scheduling limits:** an event starts in the future, at most 2 years ahead, and lasts at most 14 days.

## Database schema

MySQL 8, InnoDB, plain SQL. The schema is built by numbered files in [`server/src/db/migrations/`](server/src/db/migrations). `npm run migrate` applies the ones not yet recorded in the `schema_migrations` table, each once, in order.

| Migration | What it does |
|---|---|
| `001_create_users.sql` | `users` |
| `002_create_event_categories.sql` | `event_categories` |
| `003_create_events.sql` | `events` |
| `004_create_event_registrations.sql` | `event_registrations` (seats, waitlist and tickets) |
| `005_create_event_attendance.sql` | `event_attendance` |
| `006_create_notifications.sql` | `notifications` |
| `007_create_refresh_tokens.sql` | `refresh_tokens` (one row per login session) |
| `008_drop_users_token_version.sql` | Removes `users.token_version`, replaced by per-token revocation in `refresh_tokens` |
| `009_create_user_avatars.sql` | `user_avatars` (profile photos) |
| `010_create_event_covers.sql` | `event_covers` (event cover images) |
| `011_add_event_details.sql` | Adds the optional event-page details to `events` |

```mermaid
erDiagram
    users ||--o{ events : organizes
    event_categories ||--o{ events : groups
    users ||--o{ event_registrations : makes
    events ||--o{ event_registrations : has
    event_registrations ||--o| event_attendance : "checked in as"
    users ||--o{ notifications : receives
    users ||--o{ refresh_tokens : "logged in with"
    users ||--o| user_avatars : has
    events ||--o| event_covers : has
```

| Table | Main columns | Rules enforced by the database |
|---|---|---|
| `users` | `full_name`, `email`, `password_hash` (bcrypt), `role` (student / organizer / admin), `department`, `student_number`, `is_active` | Email unique (case-insensitive); student number unique |
| `event_categories` | `name`, `slug`, `description` | Name and slug unique |
| `events` | `organizer_id`, `category_id`, `title`, `tagline`, `description`, `venue`, `starts_at`, `ends_at`, `registration_deadline`, `cancellation_window_hours`, `capacity`, `confirmed_count`, `status` (draft / pending / published / rejected / closed), `rejection_reason`, `reviewed_by`; `agenda`, `speakers`, `tags` (JSON lists); `what_to_bring`, `entry_notes`, `contact` | `CHECK (confirmed_count <= capacity)`, so the database itself refuses an overbooking; capacity 1–100,000; ends after it starts; registration closes at or before the start; a rejected event must have a reason. Full-text index on title, description and venue for search |
| `event_registrations` | `event_id`, `user_id`, `status` (confirmed / waitlisted / cancelled), `waitlist_position`, `ticket_code`, `registered_at`, `promoted_at`, `cancelled_at` | **One active registration per student per event**: a unique key on (event, student, `active_marker`), where `active_marker` is a generated column that is NULL for cancelled rows. Cancelled history is kept, and a student can register again after cancelling. Waitlist positions unique per event; ticket codes unique; only waitlisted rows have a position; only cancelled rows have `cancelled_at` |
| `event_attendance` | `registration_id`, `status` (attended / no_show), `checked_in_at`, `marked_by` | One record per registration; "attended" always has a check-in time |
| `notifications` | `user_id`, `event_id`, `type`, `title`, `message`, `read_at` | Deleted with their user; kept (without the link) if the event is deleted |
| `refresh_tokens` | `user_id`, `jti`, `expires_at`, `revoked_at` | `jti` unique; deleted with their user |
| `user_avatars`, `event_covers` | `data` (the image, up to 1 MB), `mime_type` (JPEG / PNG / WebP), `byte_size`, `updated_at` | One per user or event, deleted with it; size limited to 1 MB by a CHECK |

`confirmed_count` is a stored copy of the number of confirmed seats. It changes only inside a registration transaction while the event row is locked (see [How concurrency is handled](#how-concurrency-is-handled)), so lists can show seats left without counting rows every time. Images are kept in their own tables so ordinary user and event queries never load them.

## Setup

### Prerequisites

- Node.js 22 or newer
- MySQL 8.0.19 or newer, running locally

### 1. Install

```bash
git clone <repository-url> eventpulse
cd eventpulse
npm install
```

The root `package.json` uses npm workspaces, so this installs both `server/` and `client/`.

### 2. Configure the server

```bash
cp server/.env.example server/.env
```

Then edit `server/.env`. At minimum set `DB_PASSWORD` and the two JWT secrets. Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` or `production`. Production turns on secure cookies, trusts one proxy, and serves the built client. |
| `PORT` | `4000` | Port the API listens on. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origin allowed by CORS. |
| `TRUST_PROXY` | `1` in production, else `0` | Number of reverse proxies in front of the app, so rate limits see the real client IP. |
| `TICKET_BASE_URL` | empty | Public URL of the app. When set, QR codes contain `<TICKET_BASE_URL>/t/<code>`; when empty, only the code. |
| `DATABASE_URL` | not set | Optional `mysql://user:password@host:3306/dbname`. Replaces the `DB_*` connection settings below. |
| `DB_HOST` | `127.0.0.1` | MySQL host. |
| `DB_PORT` | `3306` | MySQL port. |
| `DB_USER` | none (required) | MySQL user. |
| `DB_PASSWORD` | empty | MySQL password. |
| `DB_NAME` | none (required) | Database name (letters, digits and underscores only). |
| `DB_CONNECTION_LIMIT` | `10` | Connection pool size (1–100). |
| `DB_SSL` | `false` | `true` if the database requires TLS. |
| `DB_SSL_CA` | not set | The provider's CA certificate (PEM), only if it is not publicly trusted. |
| `JWT_ACCESS_SECRET` | none (required) | Signs access tokens. At least 32 characters. |
| `JWT_REFRESH_SECRET` | none (required) | Signs refresh tokens. At least 32 characters, and different from the access secret. |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Access token lifetime (1–60). |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token lifetime (1–30). |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (10–15). |

The server checks every variable at startup and exits with a clear message if one is missing or invalid.

### 3. Create the database and user

In the MySQL shell, as an administrator (use the same password as in `server/.env`):

```sql
CREATE DATABASE eventhub CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'eventhub'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON eventhub.* TO 'eventhub'@'localhost';
```

`npm run migrate` also creates the database itself if the user is allowed to, so the first line is optional in that case.

### 4. Create the tables and demo data

```bash
npm run migrate   # creates the tables; safe to run again (applies only new migrations)
npm run seed      # deletes ALL rows and inserts fictional demo data
```

**Updating an existing copy?** Run `npm run migrate` after pulling: migrations 009–011 add image storage (avatars and event covers) and the optional event details. Run `npm run seed` again if you also want the demo events' new covers, agendas and speakers.

`npm run migrate:fresh` drops and recreates the database. Both it and `seed` refuse to run with `NODE_ENV=production`.

### 5. Start

```bash
npm run dev
```

This starts the API and the Vite dev server together.

| URL | What |
|---|---|
| http://localhost:5173 | The app (Vite proxies `/api` to the server, so cookies stay same-origin) |
| http://localhost:4000/api/health | API health check, including the database |

To run it the way production does: `npm run build`, then `NODE_ENV=production npm start`, and open http://localhost:4000.

## Test accounts

All seeded accounts and data are fictional.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@eventhub.test` | `Admin@123` |
| Organizer | `computing.society@eventhub.test` | `Organizer@123` |
| Organizer | `sports.council@eventhub.test` | `Organizer@123` |
| Organizer | `arts.society@eventhub.test` | `Organizer@123` |
| Organizer | `career.office@eventhub.test` | `Organizer@123` |
| Student | `ayesha.khan@eventhub.test` (any of the 25 seeded students) | `Student@123` |

Student emails follow `first.last@eventhub.test`, for example `ali.hassan@eventhub.test` or `maryam.aslam@eventhub.test`. The full list is in `server/src/db/seed/data.js`.

## Running the tests

The tests need a migrated database (step 4 above).

```bash
npm test                 # server and client tests
npm run test:coverage    # the same, plus a coverage report; fails below the set minimums
```

The server tests start the app on a random port and run against the database in `server/.env`. Each test file creates its own users, events and categories, tagged with a per-run id, and deletes them afterwards, so seed data is left unchanged. To use a separate database instead, grant the user access to it (`GRANT ALL PRIVILEGES ON eventhub_test.* TO 'eventhub'@'localhost';`), then run `DB_NAME=eventhub_test npm run migrate` and `DB_NAME=eventhub_test npm test`.

| Suite (`server/tests/`) | Covers |
|---|---|
| `registration.test.js` | The capacity race; duplicate requests; the cancellation window and waitlist promotion; a student cannot see others' registrations or call organizer/admin endpoints; data consistency across all events; the student's registration filters. |
| `auth.test.js` | Sign-up and cookie flags; unique email and student number; identical answers for wrong password and unknown email; login lockout; forged, expired and unsigned tokens; refresh rotation and theft detection; logout; CSRF. |
| `events.test.js` | Only published and closed events are public; ended events; search, date range, sorting and paging; ETag/304 caching that updates right after a registration. |
| `eventLifecycle.test.js` | Draft, pending, approved, rejected, closed and reopened; editing rules; capacity changes; ownership; deletion. |
| `attendance.test.js` | QR tickets; check-in (including 20 simultaneous scans); check-in window; manual attendance and no-shows; no cancelling after check-in. |
| `tickets.test.js`, `ticketCode.test.js` | The public ticket-status page reveals no personal data; both QR formats; ticket code generation and parsing. |
| `organizer.test.js` | Event stats and time-zone bucketing; CSV export (formula-injection guard, quoting, ownership); registrations table search; admin user list. |
| `admin.test.js` | Creating accounts; role changes and their guards (including two admins demoting each other at once); disabling accounts; categories; analytics. |
| `validation.test.js` | Body size, content type and malformed JSON; strict numbers; hidden characters and Unicode normalisation; date limits; about 900 hostile requests across every route without a server error. |
| `images.test.js` | Avatar and cover upload, replace and remove; the real type is read from the bytes; 1 MB and type limits; who may see a student's avatar; covers private until an event is public; 304 answers. |
| `eventDetails.test.js` | Tagline, agenda, speakers, tags and notes: saving, clearing, per-item validation, and HTML stored as plain text. |
| `account.test.js`, `notifications.test.js` | Profile and password changes; the profile activity summary; notifications and their privacy. |
| `production.test.js`, `databaseUrl.test.js`, `errorHandler.test.js` | Serving the built client (fallback, cache headers, CSP); `DATABASE_URL` parsing; no internal details in 500 errors. |

Client tests (`client/tests/`) cover the form validation rules, the event form (schedule and detail rules), the safe formatting renderer (script and `javascript:` link injection), image resizing maths, `.ics` generation, formatting, error helpers, navigation per role, command search, keyboard shortcuts, placeholder colours and password suggestions.

### Where capacity, duplicate registration and authorization are proven

| Rule | Test (`server/tests/`) |
|---|---|
| **Capacity is never exceeded** | `registration.test.js`: "25 students racing for 1 seat: exactly 1 confirmed, 24 waitlisted at positions 1-24"; "no upcoming event has a free seat while someone is waitlisted". `eventLifecycle.test.js`: "capacity cannot drop below the confirmed seats; raising it moves the waitlist up" |
| **No duplicate registration** | `registration.test.js`: "one student sending 10 parallel requests: 1 created, 9 ALREADY_REGISTERED"; "no student has two active registrations for the same event" (checked across the whole database) |
| **Students can't use organizer or admin features** | `registration.test.js`: "a student cannot call organizer or admin endpoints (403)": listing, viewing, editing and closing events, the registrations table, approving. It also checks that nothing changed |
| **Students only see their own data** | `registration.test.js`: "a student cannot view or cancel another student's registration (404)". `attendance.test.js`: "another student cannot fetch someone else's QR (404)". `notifications.test.js`: "a user cannot see or mark someone else's notifications". These answer 404, not 403, so they don't even reveal that the item exists |
| **Organizers only manage their own events** | `eventLifecycle.test.js`: "another organizer can neither see nor change someone else's event" (view, edit, delete and submit all 403; the event is unchanged). `organizer.test.js`: stats and CSV export only for the event's owner or an admin. `attendance.test.js`: "only the event organizer (or an admin) can check people in". `images.test.js`: "only the event organizer or an admin can change a cover" |
| **Only admins run the platform** | `admin.test.js`: "only admins can manage users"; "organizers cannot manage categories". `organizer.test.js`: "students and organizers cannot list users". `auth.test.js`: "anyone signing up is a student, whatever role they ask for" |
| **Logged-out users are refused** | `auth.test.js`: "/auth/me needs a valid, unexpired access token" (missing, forged, expired and unsigned tokens). `notifications.test.js`: anonymous users get 401. `auth.test.js`: changes need a matching CSRF token |
| **Private images stay private** | `images.test.js`: "a student's avatar is visible only to them, admins, and organizers of their events"; "a draft's cover is private to its managers; once published it is public" |

## API reference

All paths start with `/api`. Every `POST`, `PUT`, `PATCH` and `DELETE` needs the `X-CSRF-Token` header (get the token from `GET /api/auth/csrf`). Request bodies must be JSON, except image uploads, whose body is the image itself (`Content-Type: image/jpeg`, `image/png` or `image/webp`, at most 1 MB).

**Public**

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | API and database status (503 if the database is down) |
| GET | `/categories` | All categories |
| GET | `/events` | Published and closed events; filters `q`, `category`, `from`, `to`, `sort`, `page`, `pageSize` |
| GET | `/events/:id` | One public event, with seats left and waitlist length |
| GET | `/tickets/:code` | Public ticket status (no personal data) |
| GET | `/images/avatars/:userId` | A profile photo (students' only to themselves, admins and organizers of their events) |
| GET | `/images/covers/:eventId` | An event cover (public once the event is; before that only its managers) |

**Auth** (`/auth`)

| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/auth/csrf` | anyone | Get (or keep) the CSRF token |
| POST | `/auth/register` | anyone | Create a student account and log in |
| POST | `/auth/login` | anyone | Log in |
| POST | `/auth/refresh` | refresh cookie | Rotate the refresh token and get a new access token |
| POST | `/auth/logout` | anyone | Revoke the refresh token and clear the cookies |
| GET | `/auth/me` | signed in | The current user |
| PATCH | `/auth/me` | signed in | Update name and department |
| POST | `/auth/password` | signed in | Change the password and log out other devices |
| GET | `/account/summary` | signed in | Profile activity: a student's registrations and attendance, an organizer's events |
| PUT | `/account/avatar` | signed in | Upload or replace your own profile photo |
| DELETE | `/account/avatar` | signed in | Remove your profile photo |

**Student**

| Method | Path | Purpose |
|---|---|---|
| POST | `/events/:id/registrations` | Register (seat or waitlist) |
| GET | `/me/registrations` | Own registrations; filters `scope`, `status`, `eventId` |
| GET | `/me/registrations/:id` | One own registration |
| GET | `/me/registrations/:id/qr` | Ticket QR code (PNG), confirmed seats only |
| POST | `/me/registrations/:id/cancel` | Cancel a seat or leave the waitlist |

**Notifications** (any signed-in user)

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | Own notifications, newest first, with unread count |
| GET | `/notifications/unread-count` | Unread count only |
| POST | `/notifications/read-all` | Mark all as read |
| POST | `/notifications/:id/read` | Mark one as read |

**Organizer** (organizers for their own events; admins for any event)

| Method | Path | Purpose |
|---|---|---|
| GET | `/organizer/events` | Own events (admins: all); filters `q`, `status`, `sort` |
| POST | `/organizer/events` | Create a draft |
| GET | `/organizer/events/:id` | One managed event |
| PATCH | `/organizer/events/:id` | Edit an event |
| DELETE | `/organizer/events/:id` | Delete a draft, pending or rejected event |
| POST | `/organizer/events/:id/publish` | Submit for approval, publish (admins), or reopen a closed event |
| POST | `/organizer/events/:id/close` | Close registration |
| GET | `/organizer/events/:id/stats` | Counts, attendance, registrations per day |
| GET | `/organizer/events/:id/registrations` | Registrations table; filters `q`, `status` |
| GET | `/organizer/events/:id/registrations/export` | Every registration as CSV |
| POST | `/organizer/events/:id/check-in` | Check in by ticket code or ticket link |
| PUT | `/organizer/events/:id/registrations/:registrationId/attendance` | Mark attended or no-show |
| POST | `/organizer/events/:id/attendance/no-shows` | After the event: mark all remaining as no-shows |
| PUT | `/organizer/events/:id/cover` | Upload or replace the cover image |
| DELETE | `/organizer/events/:id/cover` | Remove the cover image |

**Admin**

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/events/:id/approve` | Approve a pending event |
| POST | `/admin/events/:id/reject` | Reject with a reason |
| GET | `/admin/users` | Users; filters `q`, `role` |
| POST | `/admin/users` | Create an organizer or admin account |
| PUT | `/admin/users/:id/role` | Change a user's role |
| PUT | `/admin/users/:id/status` | Disable or enable an account |
| GET | `/admin/categories` | Categories with how many events use each |
| POST | `/admin/categories` | Create a category |
| PUT | `/admin/categories/:id` | Rename or describe a category (its link slug never changes) |
| DELETE | `/admin/categories/:id` | Delete a category no event uses |
| GET | `/admin/analytics` | Platform totals, registrations per month, demand by category, top events |

Errors always have the shape `{ "error": { "code", "message", "details"? } }`, where `details` lists field-level validation problems.

## Security notes

- **Cookies.** The access and refresh tokens live in httpOnly, `SameSite=Strict` cookies, marked `Secure` in production, so page scripts cannot read them. The refresh cookie is only sent to `/api/auth`.
- **Refresh tokens** are stored in the database and rotated on every use. If an already-used token comes back more than 10 seconds later, it is treated as stolen and every session of that user is revoked. Changing the password logs out other devices.
- **CSRF.** Every state-changing request must echo the CSRF cookie in the `X-CSRF-Token` header, which another site cannot read. In production the cookie uses the `__Host-` prefix.
- **Rate limits:**

  | Scope | Limit |
  |---|---|
  | `/api/auth` per IP | 300 requests per 15 minutes |
  | Sign-up per IP | 20 per hour |
  | Failed logins per IP and email | 5 per 15 minutes |
  | Password-change attempts per user | 5 per 15 minutes |
  | Image uploads per user | 30 per 15 minutes |
  | Public ticket lookups per IP | 60 per minute |

- **The 15-minute window after logout.** Logging out revokes the refresh token and clears the cookies, but access tokens are not individually revocable. A copied access token keeps working until it expires (`ACCESS_TOKEN_TTL_MINUTES`, 15 by default). The same applies to other devices after a password change. Disabling an account or changing a role takes effect immediately, because every request re-reads the user from the database.
- **Single instance only.** The response cache and the rate-limit counters live in the Node process's memory. That is correct for one server. Running several instances would need a shared store (such as Redis), or seat counts could look stale and the rate limits would multiply.
- **Images** are stored in the database (so they survive redeploys) and limited to 1 MB. The type is read from the file's first bytes, never from what the browser claims, and only JPEG, PNG and WebP are accepted: SVG is refused because it can contain scripts. A student's photo is only shown to them, to admins, and to organizers of events they registered for; anyone else gets a 404, as if it did not exist. Images are served with an ETag and a versioned URL, and are marked `private` when not everyone may see them.
- **Formatted text** (event descriptions) is never inserted into the page as HTML. A small Markdown subset is turned into React elements, so `<script>` shows as text, and only `http`, `https` and `mailto` links become links.
- **Passwords** are hashed with bcrypt; hashes are never returned by the API, and a login for an unknown email takes as long as one with a wrong password.
- **Input validation:**
  - Request bodies must be JSON and at most 100 KB.
  - Ids and numbers must be plain whole numbers.
  - Text is trimmed and Unicode-normalised; control characters and text-direction overrides are rejected.
  - Length limits match the database columns: names 100 characters, titles 150, descriptions 5,000.
  - Capacity must be 1–100,000.
  - Dates need an explicit time zone and must fall between 2000 and 2100.
  - Passwords: at least 8 characters with upper- and lower-case letters and a digit, at most 72 bytes, and no NUL character.
  - Unknown fields in a request are ignored, never applied.
- **Other protections:**
  - All SQL is parameterised.
  - CSV exports neutralise spreadsheet formulas.
  - helmet sets a Content-Security-Policy and other security headers.
  - Unexpected errors return a generic 500 and are logged only on the server.

## Deployment

EventPulse deploys as a single Node service that serves both the API and the built React app. [DEPLOY.md](DEPLOY.md) lists the environment variables, the build, migrate and start commands, and a Railway walkthrough.

Live demo: [LIVE URL: to be added]

## Screenshots

These are terminal screenshots of `npm test` runs in `server/`, taken as the project grew. The most recent run shows all 130 server tests passing:

- **Registration engine suite only: capacity race, duplicates, cancellation, access control, consistency (9 tests passing)** (`Screenshot 2026-11-24 at 3.18.55 AM.png`)

  ![Registration engine suite only: capacity race, duplicates, cancellation, access control, consistency (9 tests passing)](screenshots/Screenshot%202026-11-24%20at%203.18.55%E2%80%AFAM.png)

- **Full server suite, part 1 (55 tests at the time)** (`Screenshot 2026-11-24 at 10.09.04 AM.png`)

  ![Full server suite, part 1 (55 tests at the time)](screenshots/Screenshot%202026-11-24%20at%2010.09.04%E2%80%AFAM.png)

- **Full server suite, part 2: 55 of 55 passing** (`Screenshot 2026-11-24 at 10.09.27 AM.png`)

  ![Full server suite, part 2: 55 of 55 passing](screenshots/Screenshot%202026-11-24%20at%2010.09.27%E2%80%AFAM.png)

- **Full server suite after the admin features, part 1** (`Screenshot 2026-11-24 at 3.53.34 PM.png`)

  ![Full server suite after the admin features, part 1](screenshots/Screenshot%202026-11-24%20at%203.53.34%E2%80%AFPM.png)

- **Full server suite after the admin features, part 2** (`Screenshot 2026-11-24 at 3.53.53 PM.png`)

  ![Full server suite after the admin features, part 2](screenshots/Screenshot%202026-11-24%20at%203.53.53%E2%80%AFPM.png)

- **Full server suite after the admin features, part 3: 69 of 69 passing** (`Screenshot 2026-11-24 at 3.54.22 PM.png`)

  ![Full server suite after the admin features, part 3: 69 of 69 passing](screenshots/Screenshot%202026-11-24%20at%203.54.22%E2%80%AFPM.png)

- **Current full server suite, part 1: profile, password, admin accounts, roles, categories, analytics, tickets, check-in** (`Screenshot 2026-11-24 at 4.18.48 PM.png`)

  ![Current full server suite, part 1: profile, password, admin accounts, roles, categories, analytics, tickets, check-in](screenshots/Screenshot%202026-11-24%20at%204.18.48%E2%80%AFPM.png)

- **Current full server suite, part 2: attendance, sign-up, login, sessions, CSRF, error handler, event lifecycle** (`Screenshot 2026-11-24 at 4.19.06 PM.png`)

  ![Current full server suite, part 2: attendance, sign-up, login, sessions, CSRF, error handler, event lifecycle](screenshots/Screenshot%202026-11-24%20at%204.19.06%E2%80%AFPM.png)

- **Current full server suite, part 3: public events, filtering, caching, notifications, stats, CSV, production serving, registration engine** (`Screenshot 2026-11-24 at 4.19.34 PM.png`)

  ![Current full server suite, part 3: public events, filtering, caching, notifications, stats, CSV, production serving, registration engine](screenshots/Screenshot%202026-11-24%20at%204.19.34%E2%80%AFPM.png)

- **Current full server suite, part 4: tickets, validation and hostile input: 130 of 130 passing** (`Screenshot 2026-11-24 at 4.19.52 PM.png`)

  ![Current full server suite, part 4: tickets, validation and hostile input: 130 of 130 passing](screenshots/Screenshot%202026-11-24%20at%204.19.52%E2%80%AFPM.png)

## Project structure

```
.
├── client/                 React app (Vite)
│   ├── public/             favicon and the pre-paint theme script
│   ├── src/
│   │   ├── api/            Axios calls, one module per area
│   │   ├── components/     shared UI (forms, charts, dialogs, scanner…)
│   │   ├── context/        auth, notifications, toasts
│   │   ├── hooks/          data loading, forms, theme…
│   │   ├── pages/          student pages, plus organizer/ and admin/
│   │   ├── styles/         design tokens and stylesheets
│   │   └── utils/          validation, formatting, dates, .ics
│   └── tests/
├── server/                 Express API
│   ├── src/
│   │   ├── config/         environment validation
│   │   ├── db/             pool, transactions, migrations/, seed/
│   │   ├── routes/         URL → middleware → controller
│   │   ├── controllers/    HTTP in and out
│   │   ├── services/       business logic and SQL
│   │   ├── schemas/        zod request schemas
│   │   ├── middleware/     auth, CSRF, validation, rate limits, errors
│   │   └── utils/
│   └── tests/
├── screenshots/
├── DEPLOY.md
└── package.json            npm workspaces and root scripts
```


## License

MIT, see [LICENSE](LICENSE).
