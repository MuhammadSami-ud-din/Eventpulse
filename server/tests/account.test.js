import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { TestContext } from './helpers.js';

const ctx = new TestContext();
before(() => ctx.start());
after(() => ctx.cleanup());

const PASSWORD = 'Original@123';
const NEW_PASSWORD = 'Changed@456';

describe('profile', () => {
  test('a user can update their name and department, and nothing else', async () => {
    const student = await ctx.createUser('student');

    const res = await student.call('PATCH', '/auth/me', {
      fullName: '  Renamed Student  ',
      department: '',
      role: 'admin',
      email: 'hijack@eventhub.test',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.fullName, 'Renamed Student');
    assert.equal(res.body.user.department, null, 'an empty department clears it');
    assert.equal(res.body.user.role, 'student');
    assert.equal(res.body.user.email, student.email);
    assert.ok(!('passwordHash' in res.body.user) && !JSON.stringify(res.body).includes('password'));
  });

  test('invalid profile input is rejected with field details', async () => {
    const student = await ctx.createUser('student');
    const res = await student.call('PATCH', '/auth/me', { fullName: 'X', department: 'y'.repeat(101) });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['department', 'fullName']);
  });
});

describe('changing password', () => {
  test('a wrong current password is a 400 on that field (not a 401 that looks like a dead session)', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);

    const res = await session.call('POST', '/auth/password', { currentPassword: 'Wrong@123', newPassword: NEW_PASSWORD });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.details[0].field, 'currentPassword');
  });

  test('the new password must meet the policy and differ from the old one', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const session = await ctx.login(user.email, PASSWORD);

    for (const newPassword of ['short', 'alllowercase1', PASSWORD]) {
      const res = await session.call('POST', '/auth/password', { currentPassword: PASSWORD, newPassword });
      assert.equal(res.status, 400, newPassword);
      assert.equal(res.body.error.details[0].field, 'newPassword');
    }
  });

  test('success keeps this session, logs out other devices, and swaps the password', async () => {
    const user = await ctx.createUser('student', { password: PASSWORD });
    const laptop = await ctx.login(user.email, PASSWORD);
    const phone = await ctx.login(user.email, PASSWORD);
    assert.equal(laptop.loginStatus, 200);

    const res = await laptop.call('POST', '/auth/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(res.status, 200);

    assert.equal((await laptop.call('GET', '/auth/me')).status, 200, 'this device stays logged in');
    assert.equal((await laptop.call('POST', '/auth/refresh')).status, 200, 'with a working refresh token');
    assert.equal((await phone.call('POST', '/auth/refresh')).status, 401, 'other devices are logged out');

    assert.equal((await ctx.login(user.email, PASSWORD)).loginStatus, 401);
    assert.equal((await ctx.login(user.email, NEW_PASSWORD)).loginStatus, 200);
  });
});
