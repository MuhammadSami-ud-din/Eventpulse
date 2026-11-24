// Hosting platforms usually hand out one connection string, e.g.
// mysql://user:p%40ss@db.example.com:3306/eventhub. This splits it into the
// separate DB_* settings the rest of the app uses.
export function parseDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }
  if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must start with mysql://');

  return {
    // IPv6 hosts come wrapped in brackets: mysql://u:p@[::1]:3306/db
    DB_HOST: url.hostname.replace(/^\[|\]$/g, ''),
    DB_PORT: url.port || '3306',
    // User and password are percent-encoded in URLs (e.g. "@" becomes "%40").
    DB_USER: decodeURIComponent(url.username),
    DB_PASSWORD: decodeURIComponent(url.password),
    DB_NAME: decodeURIComponent(url.pathname.slice(1)),
  };
}
