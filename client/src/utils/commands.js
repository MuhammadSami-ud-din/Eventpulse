import { navigationFor } from './navigation.js';

// Everything the command palette can do for this user: every page they can
// reach, plus a few actions. `run` is attached later by the palette itself.
export function commandsFor(user) {
  const pages = navigationFor(user).flatMap((group) =>
    group.items.map((item) => ({ id: `page:${item.to}`, group: 'Pages', label: item.label, icon: item.icon, to: item.to })),
  );
  const actions = [
    { id: 'action:theme', group: 'Actions', label: 'Toggle dark theme', icon: 'moon', keywords: 'light mode appearance' },
    { id: 'action:shortcuts', group: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', keywords: 'help keys' },
  ];
  if (user) {
    actions.push({ id: 'action:logout', group: 'Actions', label: 'Log out', icon: 'logout', keywords: 'sign out exit' });
  } else {
    pages.push(
      { id: 'page:/login', group: 'Pages', label: 'Log in', icon: 'user', to: '/login', keywords: 'sign in' },
      { id: 'page:/register', group: 'Pages', label: 'Sign up', icon: 'user', to: '/register', keywords: 'register create account' },
    );
  }
  return [...pages, ...actions];
}

// Ranks commands against what was typed: a label that starts with it first,
// then one with a word starting with it, then any other match in the label
// or keywords. Commands that do not match at all are left out.
export function filterCommands(commands, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return commands;
  const rank = (command) => {
    const label = command.label.toLowerCase();
    if (label.startsWith(needle)) return 0;
    if (label.split(/\s+/).some((word) => word.startsWith(needle))) return 1;
    if (label.includes(needle)) return 2;
    if (command.keywords?.toLowerCase().includes(needle)) return 3;
    return null;
  };
  return commands
    .map((command, index) => ({ command, index, rank: rank(command) }))
    .filter((entry) => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.command);
}
