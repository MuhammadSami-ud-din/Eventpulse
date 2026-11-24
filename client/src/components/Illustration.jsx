import { Icon } from './Icon.jsx';

// A soft glowing disc with an icon in it, for empty and error states.
// Decorative only: the heading next to it says what is going on.
export function Illustration({ icon, tone = 'primary' }) {
  return (
    <div className={`illustration illustration--${tone}`} aria-hidden="true">
      <svg className="illustration__rings" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="42" />
      </svg>
      <span className="illustration__icon">
        <Icon name={icon} size={36} />
      </span>
    </div>
  );
}
