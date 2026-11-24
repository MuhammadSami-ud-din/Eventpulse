import { avatarBackground, initials } from '../utils/placeholder.js';

// The user's photo, or their initials on a colour picked from their id.
// Decorative either way: the name is always written next to it.
export function Avatar({ user, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (user.avatarUrl) {
    return <img className="avatar avatar--photo" src={user.avatarUrl} alt="" width={size} height={size} style={style} loading="lazy" />;
  }
  return (
    <span className="avatar" style={{ ...style, background: avatarBackground(user.id ?? user.fullName) }} aria-hidden="true">
      {initials(user.fullName)}
    </span>
  );
}
