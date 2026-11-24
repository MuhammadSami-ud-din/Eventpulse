import { fetchEvents } from '../api/events.js';
import { useAsync } from '../hooks/useAsync.js';
import { formatEventTime } from '../utils/format.js';
import { safeHref } from '../utils/markdown.js';
import { Avatar } from './Avatar.jsx';
import { EventCard } from './EventCard.jsx';
import { EventCover } from './EventCover.jsx';
import { Icon } from './Icon.jsx';
import { Markdown } from './Markdown.jsx';

// The event page's parts. The organizer's live preview renders the same
// components, so what they see while editing is what students will see.

const isValidDate = (value) => value && !Number.isNaN(new Date(value).getTime());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function whenText(event) {
  return isValidDate(event.startsAt) && isValidDate(event.endsAt)
    ? formatEventTime(event.startsAt, event.endsAt)
    : 'Date and time to be set';
}

// `level` is the heading level of the title (1 on the event page, 2 in a preview).
export function EventHero({ event, level = 1, badge }) {
  const Title = `h${level}`;
  const organizer = { id: event.organizer.id, fullName: event.organizer.name, avatarUrl: event.organizer.avatarUrl };
  return (
    <header className="hero">
      <EventCover eventId={event.id} coverUrl={event.coverUrl} className="hero__cover" />
      <div className="hero__body">
        <div className="hero__chips">
          {event.category?.name && <span className="chip-label">{event.category.name}</span>}
          {badge}
        </div>
        <Title className="hero__title">{event.title}</Title>
        {event.tagline && <p className="hero__tagline">{event.tagline}</p>}
        <ul className="hero__facts">
          <li>
            <Icon name="clock" size={18} />
            {whenText(event)}
          </li>
          <li>
            <Icon name="pin" size={18} />
            {event.venue || 'Venue to be set'}
          </li>
          <li>
            <Avatar user={organizer} size={24} />
            Hosted by {event.organizer.name}
          </li>
        </ul>
        {event.tags.length > 0 && (
          <ul className="tag-list" aria-label="Tags">
            {event.tags.map((tag) => (
              <li key={tag} className="tag">
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  );
}

// An email becomes a mailto link, a web address a link, anything else text.
function ContactValue({ contact }) {
  const href = EMAIL.test(contact) ? safeHref(`mailto:${contact}`) : /^https?:\/\//i.test(contact) ? safeHref(contact) : null;
  return href ? <a href={href}>{contact}</a> : contact;
}

// About, Agenda, Speakers and Location, with a small "on this page" menu.
// Sections without content are left out. `level` is the sections' heading level.
export function EventSections({ event, level = 2 }) {
  const Heading = `h${level}`;
  const sections = [
    { id: 'about', label: 'About' },
    event.agenda.length > 0 && { id: 'agenda', label: 'Agenda' },
    event.speakers.length > 0 && { id: 'speakers', label: 'Speakers' },
    { id: 'location', label: 'Location' },
  ].filter(Boolean);
  // A preview can sit on the same page as the real thing, so its ids differ.
  const prefix = level === 2 ? '' : 'preview-';

  return (
    <div className="event-sections">
      <nav className="section-nav" aria-label="On this page">
        {sections.map((section) => (
          <a key={section.id} href={`#${prefix}${section.id}`}>
            {section.label}
          </a>
        ))}
      </nav>

      <section id={`${prefix}about`} className="event-section" aria-labelledby={`${prefix}about-heading`}>
        <Heading id={`${prefix}about-heading`}>About this event</Heading>
        <Markdown text={event.description || 'No description yet.'} />
      </section>

      {event.agenda.length > 0 && (
        <section id={`${prefix}agenda`} className="event-section" aria-labelledby={`${prefix}agenda-heading`}>
          <Heading id={`${prefix}agenda-heading`}>Agenda</Heading>
          <ol className="agenda">
            {event.agenda.map((item, index) => (
              <li key={index} className="agenda__item">
                <time className="agenda__time">{item.time}</time>
                <div>
                  <p className="agenda__title">{item.title}</p>
                  {item.details && <p className="agenda__details">{item.details}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {event.speakers.length > 0 && (
        <section id={`${prefix}speakers`} className="event-section" aria-labelledby={`${prefix}speakers-heading`}>
          <Heading id={`${prefix}speakers-heading`}>Speakers and hosts</Heading>
          <ul className="speakers">
            {event.speakers.map((speaker, index) => (
              <li key={index} className="speaker">
                <Avatar user={{ id: speaker.name, fullName: speaker.name }} size={44} />
                <div>
                  <p className="speaker__name">{speaker.name}</p>
                  {speaker.role && <p className="speaker__role">{speaker.role}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id={`${prefix}location`} className="event-section" aria-labelledby={`${prefix}location-heading`}>
        <Heading id={`${prefix}location-heading`}>Location and entry</Heading>
        <dl className="details-list">
          <div>
            <dt>
              <Icon name="pin" size={18} /> Venue
            </dt>
            <dd>{event.venue || 'To be set'}</dd>
          </div>
          <div>
            <dt>
              <Icon name="clock" size={18} /> When
            </dt>
            <dd>{whenText(event)}</dd>
          </div>
          {event.whatToBring && (
            <div>
              <dt>
                <Icon name="backpack" size={18} /> What to bring
              </dt>
              <dd className="details-list__multiline">{event.whatToBring}</dd>
            </div>
          )}
          {event.entryNotes && (
            <div>
              <dt>
                <Icon name="info" size={18} /> Dress code and entry
              </dt>
              <dd className="details-list__multiline">{event.entryNotes}</dd>
            </div>
          )}
          {event.contact && (
            <div>
              <dt>
                <Icon name="mail" size={18} /> Contact
              </dt>
              <dd>
                <ContactValue contact={event.contact} />
              </dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

// Up to three other upcoming events in the same category.
export function RelatedEvents({ event }) {
  const { data } = useAsync(
    (signal) => fetchEvents({ category: event.category.slug, pageSize: 4 }, { signal }).then((page) => page.data),
    [event.id, event.category.slug],
  );
  const related = (data ?? []).filter((other) => other.id !== event.id).slice(0, 3);
  if (related.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-heading">
      <h2 id="related-heading">More in {event.category.name}</h2>
      <div className="event-grid">
        {related.map((other) => (
          <EventCard key={other.id} event={other} />
        ))}
      </div>
    </section>
  );
}
