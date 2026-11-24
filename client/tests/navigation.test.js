import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { commandsFor, filterCommands } from '../src/utils/commands.js';
import { isActivePath, navigationFor } from '../src/utils/navigation.js';
import { shortcutFor } from '../src/utils/shortcuts.js';

const groupIds = (user) => navigationFor(user).map((group) => group.id);
const labels = (user) => navigationFor(user).flatMap((group) => group.items.map((item) => item.label));

describe('side navigation', () => {
  test('each role sees only its own sections', () => {
    assert.deepEqual(groupIds(null), ['discover']);
    assert.deepEqual(groupIds({ role: 'student' }), ['discover', 'student', 'account']);
    assert.deepEqual(groupIds({ role: 'organizer' }), ['discover', 'organizer', 'account']);
    assert.deepEqual(groupIds({ role: 'admin' }), ['discover', 'organizer', 'admin', 'account']);
  });

  test('organizers see "My events", admins "Manage events"', () => {
    assert.ok(labels({ role: 'organizer' }).includes('My events'));
    assert.ok(labels({ role: 'admin' }).includes('Manage events'));
  });

  test('an item stays active on the pages below it, except the ones it excludes', () => {
    const [, organizer] = navigationFor({ role: 'organizer' });
    const [myEvents, newEvent] = organizer.items;
    assert.ok(isActivePath(myEvents, '/organizer'));
    assert.ok(isActivePath(myEvents, '/organizer/events/12/check-in'));
    assert.ok(!isActivePath(myEvents, '/organizer/events/new'));
    assert.ok(isActivePath(newEvent, '/organizer/events/new'));
    const [events] = navigationFor(null)[0].items;
    assert.ok(isActivePath(events, '/') && !isActivePath(events, '/events/3'), '"/" matches only the home page');
  });
});

describe('command palette', () => {
  test('guests can log in or sign up; signed-in users can log out', () => {
    const guest = commandsFor(null).map((command) => command.label);
    assert.ok(guest.includes('Log in') && guest.includes('Sign up') && !guest.includes('Log out'));
    assert.ok(commandsFor({ role: 'student' }).some((command) => command.label === 'Log out'));
  });

  test('matches rank: start of label, then start of a word, then anywhere, then keywords', () => {
    const commands = [
      { label: 'My registrations' },
      { label: 'Registrations report' },
      { label: 'Unregistered' },
      { label: 'Toggle dark theme', keywords: 'appearance light' },
      { label: 'Profile' },
    ];
    const result = filterCommands(commands, 'reg').map((command) => command.label);
    assert.deepEqual(result, ['Registrations report', 'My registrations', 'Unregistered']);
    assert.deepEqual(filterCommands(commands, 'LIGHT').map((c) => c.label), ['Toggle dark theme']);
    assert.equal(filterCommands(commands, '  ').length, commands.length, 'empty query shows everything');
  });
});

describe('keyboard shortcuts', () => {
  const key = (key, extra = {}) => ({ key, target: { tagName: 'BODY' }, ...extra });
  const typingIn = (tagName, type) => ({ tagName, type });

  test('Ctrl+K and Cmd+K open the palette, even while typing', () => {
    assert.equal(shortcutFor(key('k', { ctrlKey: true })), 'palette');
    assert.equal(shortcutFor(key('K', { metaKey: true, target: typingIn('INPUT', 'text') })), 'palette');
  });

  test('"/" and "?" work only when not typing', () => {
    assert.equal(shortcutFor(key('/')), 'search');
    assert.equal(shortcutFor(key('?')), 'help');
    assert.equal(shortcutFor(key('/', { target: typingIn('INPUT', 'search') })), null);
    assert.equal(shortcutFor(key('?', { target: typingIn('TEXTAREA') })), null);
    assert.equal(shortcutFor(key('/', { target: { tagName: 'DIV', isContentEditable: true } })), null);
    assert.equal(shortcutFor(key('/', { target: typingIn('INPUT', 'checkbox') })), 'search', 'a checkbox is not typing');
  });

  test('other keys and modified keys do nothing', () => {
    assert.equal(shortcutFor(key('a')), null);
    assert.equal(shortcutFor(key('/', { ctrlKey: true })), null);
    assert.equal(shortcutFor(key('k', { ctrlKey: true, altKey: true })), null);
  });
});
