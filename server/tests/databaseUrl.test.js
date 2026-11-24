import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseDatabaseUrl } from '../src/config/databaseUrl.js';

describe('DATABASE_URL parsing', () => {
  test('splits a connection string into DB_* settings, decoding credentials', () => {
    assert.deepEqual(parseDatabaseUrl('mysql://app%40prod:p%3Ass%2Fw0rd@db.example.com:3310/eventhub'), {
      DB_HOST: 'db.example.com',
      DB_PORT: '3310',
      DB_USER: 'app@prod',
      DB_PASSWORD: 'p:ss/w0rd',
      DB_NAME: 'eventhub',
    });
  });

  test('defaults the port to 3306 and handles IPv6 hosts', () => {
    const parsed = parseDatabaseUrl('mysql://root:secret@[::1]/eventhub');
    assert.equal(parsed.DB_HOST, '::1');
    assert.equal(parsed.DB_PORT, '3306');
  });

  test('rejects other databases and malformed strings', () => {
    assert.throws(() => parseDatabaseUrl('postgres://u:p@host/db'), /must start with mysql:\/\//);
    assert.throws(() => parseDatabaseUrl('not a url'), /not a valid URL/);
  });
});
