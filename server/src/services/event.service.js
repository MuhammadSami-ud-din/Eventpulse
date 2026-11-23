import { pool } from '../db/pool.js';
import { containsPattern } from '../utils/sql.js';
import { cacheKeys, remember } from './cache.js';

export const PUBLIC_STATUSES = ['published', 'closed'];

// InnoDB's FULLTEXT index skips words shorter than this (innodb_ft_min_token_size).
const FULLTEXT_MIN_WORD_LENGTH = 3;
// Characters with special meaning in BOOLEAN MODE; removed so user input is plain words.
const FULLTEXT_OPERATORS = /[+\-<>()~*"@]/g;
// InnoDB's default stopwords are never indexed, so requiring one ("+the*")
// would make every search containing it return nothing. They are dropped.
const FULLTEXT_STOPWORDS = new Set([
  'a', 'about', 'an', 'are', 'as', 'at', 'be', 'by', 'com', 'de', 'en', 'for', 'from', 'how', 'i', 'in',
  'is', 'it', 'la', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'und', 'was', 'what', 'when', 'where',
  'who', 'will', 'with', 'www',
]);

const SORT_ORDERS = {
  date: 'e.starts_at ASC, e.id ASC',
  date_desc: 'e.starts_at DESC, e.id DESC',
  newest: 'e.created_at DESC, e.id DESC',
  popular: 'e.confirmed_count DESC, e.starts_at ASC',
};

const EVENT_FROM = `
  FROM events e
  JOIN event_categories c ON c.id = e.category_id
  JOIN users u ON u.id = e.organizer_id`;

const EVENT_SELECT = `
  SELECT
    e.id, e.title, e.description, e.venue, e.starts_at, e.ends_at, e.registration_deadline,
    e.cancellation_window_hours, e.capacity, e.confirmed_count, e.status, e.rejection_reason,
    e.created_at, e.updated_at,
    c.id AS category_id, c.name AS category_name, c.slug AS category_slug,
    u.id AS organizer_id, u.full_name AS organizer_name,
    (SELECT COUNT(*) FROM event_registrations r
      WHERE r.event_id = e.id AND r.status = 'waitlisted') AS waitlist_count
  ${EVENT_FROM}`;

export function toEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    venue: row.venue,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    registrationDeadline: row.registration_deadline,
    cancellationWindowHours: row.cancellation_window_hours,
    capacity: row.capacity,
    confirmedCount: row.confirmed_count,
    seatsLeft: row.capacity - row.confirmed_count,
    waitlistCount: Number(row.waitlist_count),
    status: row.status,
    rejectionReason: row.rejection_reason,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
    organizer: { id: row.organizer_id, name: row.organizer_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Uses the FULLTEXT index when every word is long enough for it, otherwise a
// LIKE scan on title and venue so short searches like "AI" still match.
function searchCondition(q) {
  const words = q
    .replace(FULLTEXT_OPERATORS, ' ')
    .split(/\s+/)
    .filter((word) => word && !FULLTEXT_STOPWORDS.has(word.toLowerCase()));
  if (words.length > 0 && words.every((word) => word.length >= FULLTEXT_MIN_WORD_LENGTH)) {
    return {
      sql: 'MATCH (e.title, e.description, e.venue) AGAINST (? IN BOOLEAN MODE)',
      // "+word*": every word must appear, as a prefix (so "work" finds "workshop").
      params: [words.map((word) => `+${word}*`).join(' ')],
    };
  }
  const pattern = containsPattern(q);
  return { sql: '(e.title LIKE ? OR e.venue LIKE ?)', params: [pattern, pattern] };
}

// Returns a WHERE clause and its parameters. Only fixed SQL fragments are
// concatenated; every user-supplied value goes through a placeholder.
export function buildEventFilters({ statuses, organizerId, q, category, from, to }) {
  const conditions = [];
  const params = [];

  if (statuses?.length) {
    conditions.push(`e.status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (organizerId) {
    conditions.push('e.organizer_id = ?');
    params.push(organizerId);
  }
  if (q) {
    const search = searchCondition(q);
    conditions.push(search.sql);
    params.push(...search.params);
  }
  if (category) {
    conditions.push('c.slug = ?');
    params.push(category);
  }
  // An event counts as "in range" if it has not ended by `from` and starts by `to`.
  if (from) {
    conditions.push('e.ends_at >= ?');
    params.push(from);
  }
  if (to) {
    conditions.push('e.starts_at <= ?');
    params.push(to);
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

// query() rather than execute(): MySQL's prepared-statement protocol rejects
// numeric LIMIT/OFFSET parameters from mysql2. query() still escapes every value.
export async function queryEventPage(filters, { sort = 'date', page, pageSize }) {
  const { where, params } = buildEventFilters(filters);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${EVENT_FROM} ${where}`, params);
  const [rows] = await pool.query(
    `${EVENT_SELECT} ${where} ORDER BY ${SORT_ORDERS[sort]} LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  return {
    data: rows.map(toEvent),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function findEventById(db, eventId) {
  const [rows] = await db.query(`${EVENT_SELECT} WHERE e.id = ?`, [eventId]);
  return rows[0] ? toEvent(rows[0]) : null;
}

// Without an explicit `from`, the list shows events that have not ended yet.
// "now" is applied at query time and left out of the cache key, so the key
// stays stable; the short cache TTL bounds how stale "now" can get.
export function listPublicEvents(query) {
  return remember(cacheKeys.eventList(query), () =>
    queryEventPage(
      { ...query, statuses: PUBLIC_STATUSES, from: query.from ?? new Date() },
      query,
    ),
  );
}

export async function getPublicEvent(eventId) {
  const event = await remember(cacheKeys.eventDetail(eventId), () => findEventById(pool, eventId));
  return event && PUBLIC_STATUSES.includes(event.status) ? event : null;
}
