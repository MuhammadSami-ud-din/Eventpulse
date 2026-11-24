// What the side navigation and the command palette offer each user. Groups
// only appear for roles that have them; a guest sees just the events.

const isStaff = (user) => user?.role === 'organizer' || user?.role === 'admin';

export function navigationFor(user) {
  const groups = [{ id: 'discover', label: 'Discover', items: [{ to: '/', label: 'Events', icon: 'calendar', end: true }] }];
  if (!user) return groups;

  if (user.role === 'student') {
    groups.push({
      id: 'student',
      label: 'Student',
      items: [{ to: '/my/registrations', label: 'My registrations', icon: 'ticket' }],
    });
  }
  if (isStaff(user)) {
    groups.push({
      id: 'organizer',
      label: 'Organizer',
      items: [
        // Stays highlighted on an event's own pages, but not on "New event".
        {
          to: '/organizer',
          label: user.role === 'admin' ? 'Manage events' : 'My events',
          icon: 'layout',
          exclude: ['/organizer/events/new'],
        },
        { to: '/organizer/events/new', label: 'New event', icon: 'plus', end: true },
      ],
    });
  }
  if (user.role === 'admin') {
    groups.push({
      id: 'admin',
      label: 'Admin',
      items: [
        { to: '/admin', label: 'Approvals', icon: 'check', end: true },
        { to: '/admin/users', label: 'Users', icon: 'users' },
        { to: '/admin/categories', label: 'Categories', icon: 'tag' },
        { to: '/admin/analytics', label: 'Analytics', icon: 'chart' },
      ],
    });
  }
  groups.push({
    id: 'account',
    label: 'Account',
    items: [
      { to: '/notifications', label: 'Notifications', icon: 'bell', badge: 'unread' },
      { to: '/profile', label: 'Profile', icon: 'user' },
    ],
  });
  return groups;
}

// `end` items match only their exact path; others also match the pages below
// them (e.g. /organizer/events/12 under "My events"), minus any `exclude`.
export function isActivePath(item, pathname) {
  if (pathname === item.to) return true;
  if (item.end) return false;
  const prefix = item.to.endsWith('/') ? item.to : `${item.to}/`;
  return pathname.startsWith(prefix) && !(item.exclude ?? []).some((path) => pathname.startsWith(path));
}
