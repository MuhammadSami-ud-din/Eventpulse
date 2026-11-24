import { coverBackground } from '../utils/placeholder.js';

// An event's cover image, or a gradient generated from its id. The cover is
// decorative: the title and details are always written out beside it.
export function EventCover({ eventId, coverUrl, className = '', children }) {
  return (
    <div className={`cover ${className}`} style={coverUrl ? undefined : { background: coverBackground(`event-${eventId}`) }}>
      {coverUrl && <img className="cover__image" src={coverUrl} alt="" loading="lazy" decoding="async" />}
      {children}
    </div>
  );
}
