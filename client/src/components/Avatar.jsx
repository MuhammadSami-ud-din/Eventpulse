import { avatarBackground, initials } from '../utils/placeholder.js';

// Initials on a colour picked from the user's id. The name is announced by
// the surrounding text, so the avatar itself is decorative.
export function Avatar({ user, size = 40 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: avatarBackground(user.id ?? user.fullName) }}
      aria-hidden="true"
    >
      {initials(user.fullName)}
    </span>
  );
}
