# Deploying EventPulse

EventPulse deploys as **one Node service**: in production, Express serves the API
under `/api` and the built React app for every other path. You need:

- a host that runs Node.js 22+ behind HTTPS (Railway, Render, Fly.io, a VPS with nginx…)
- a MySQL **8.0.19+** database (CHECK constraints, `FOR UPDATE OF`, `INSERT … AS alias`)

HTTPS is required, not optional: the session cookies are `Secure`, and browsers
only allow the check-in camera on HTTPS pages.

## Environment variables

| Variable | Required | Example / notes |
|---|---|---|
| `NODE_ENV` | yes | `production` (serves the built client, secure cookies, trusts 1 proxy) |
| `DATABASE_URL` | yes* | `mysql://user:password@host:3306/eventhub` (percent-encode special characters in the password) |
| `JWT_ACCESS_SECRET` | yes | 32+ random characters, see below |
| `JWT_REFRESH_SECRET` | yes | 32+ random characters, **different** from the access secret |
| `CLIENT_ORIGIN` | yes | Your app's public URL, e.g. `https://eventhub.example.com` |
| `TICKET_BASE_URL` | recommended | Same public URL. QR codes then link to `/t/<code>`, a public ticket-status page. Leave empty to encode only the bare code. |
| `PORT` | no | Most hosts set this for you (default `4000`) |
| `DB_SSL` | no | `true` if the database requires TLS |
| `DB_SSL_CA` | no | The provider's CA certificate (PEM; `\n` allowed for newlines) if it is not publicly trusted |
| `TRUST_PROXY` | no | Proxies in front of the app. Defaults to `1` in production. Set `0` only if Node faces the internet directly |
| `BCRYPT_ROUNDS`, `ACCESS_TOKEN_TTL_MINUTES`, `REFRESH_TOKEN_TTL_DAYS`, `DB_CONNECTION_LIMIT` | no | Defaults: 12, 15, 7, 10 |

\* Instead of `DATABASE_URL` you can set `DB_HOST`, `DB_PORT`, `DB_USER`,
`DB_PASSWORD` and `DB_NAME`. If both are present, `DATABASE_URL` wins.

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## The three commands

| Phase | Command | Notes |
|---|---|---|
| Build | `npm ci --include=dev && npm run build` | `--include=dev` because Vite is a dev dependency and many hosts set `NODE_ENV=production` during the build, which would skip it |
| Before each deploy | `npm run migrate` | Applies new migrations only; safe to run every time |
| Start | `npm start` | Fails fast with a clear message if `client/dist` is missing or an env var is invalid |

Health check path: **`/api/health`** (returns 503 if the database is unreachable).

## Example: Railway

1. Create a project and add a **MySQL** database to it.
2. Add a service from your GitHub repository.
3. In the service's **Variables**, set:
   - `NODE_ENV=production`
   - `DATABASE_URL=${{MySQL.MYSQL_URL}}` (a reference to the database's variable)
   - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (generated as above)
4. In **Settings**:
   - Build command: `npm ci --include=dev && npm run build`
   - Pre-deploy command: `npm run migrate`
   - Start command: `npm start`
   - Health check path: `/api/health`
5. Under **Networking**, generate a public domain, then add two more variables
   with that URL (and redeploy):
   - `CLIENT_ORIGIN=https://<your-domain>`
   - `TICKET_BASE_URL=https://<your-domain>`

Menu names change from time to time; if one is missing, look for the
equivalent setting in your host's documentation.

## After the first deploy

1. Open `https://<your-domain>/api/health`. It should say `{"status":"ok","database":"up"}`.
2. Create the first admin. Registration only creates students, so promote
   your own account directly in the database:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@your-university.edu';
   ```
   Organizer accounts are promoted the same way (`role = 'organizer'`) until
   the admin user-management screen arrives.
3. Test check-in on a phone: open an event's **Check-in** tab, tap
   **Start camera**, and scan a ticket.

### Demo data

`npm run seed` **deletes every row** and inserts fictional demo data, so it
refuses to run with `NODE_ENV=production`. For a demo deployment only, run it
from your own machine against the hosted database:

```bash
NODE_ENV=development DATABASE_URL='mysql://…' npm run seed
```

## Limits of a single instance

Response caching and rate-limit counters live in the Node process's memory.
That is correct for **one** instance. Before scaling to several, move both to a
shared store such as Redis, or users would see stale seat counts and the rate
limits would multiply.
