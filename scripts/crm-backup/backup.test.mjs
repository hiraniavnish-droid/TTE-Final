import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt, sha256, parseKey, expiredBackup, objectFilename } from './archive.mjs';
import { listObjects, PREFIX } from './backup.mjs';
import { versionKey } from './incremental.mjs';

test('authenticated archive roundtrip, wrong-key and tamper rejection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tte-backup-test-'));
  try {
    const source = join(root, 'source'), encrypted = join(root, 'encrypted'), target = join(root, 'target');
    const key = randomBytes(32); await writeFile(source, randomBytes(2_000_000));
    await encrypt(source, encrypted, key); await decrypt(encrypted, target, key);
    assert.equal(await sha256(source), await sha256(target));
    await assert.rejects(decrypt(encrypted, join(root, 'wrong'), randomBytes(32)));
    await assert.rejects(readFile(join(root, 'wrong'))); // Failed decrypt must leave no plaintext.
    const bytes = await readFile(encrypted); bytes[500] ^= 1; await writeFile(encrypted, bytes);
    await assert.rejects(decrypt(encrypted, join(root, 'tampered'), key));
    await assert.rejects(readFile(join(root, 'tampered')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('retention only deletes archives in the reserved namespace after 30 days', () => {
  const now = new Date('2026-10-15T06:00:00Z');
  assert.equal(expiredBackup(`${PREFIX}2026-09-01T030000Z-abcdef123456.ttebk`, PREFIX, now), true);
  assert.equal(expiredBackup(`${PREFIX}2026-10-01T030000Z-abcdef123456.ttebk`, PREFIX, now), false);
  assert.equal(expiredBackup('quotes/2026-09-01T030000Z-abcdef123456.ttebk', PREFIX, now), false);
  assert.equal(expiredBackup(`${PREFIX}some-customer-document.pdf`, PREFIX, now), false);
  assert.equal(expiredBackup(`${PREFIX}2026-09-01T030000Z-abcdef123456.ttebk`, '', now), false);
});
test('object listing consumes every page', async () => {
  const tokens = [];
  const client = { send: async command => {
    tokens.push(command.input.ContinuationToken);
    return tokens.length === 1 ? { Contents: [{ Key: 'a' }], IsTruncated: true, NextContinuationToken: 'next' } : { Contents: [{ Key: 'b' }] };
  } };
  assert.deepEqual((await listObjects(client, 'bucket')).map(x => x.Key), ['a', 'b']);
  assert.deepEqual(tokens, [undefined, 'next']);
});
test('archive paths cannot traverse folders and keys must be exact', () => {
  assert.match(objectFilename('r2', 'b', '../../etc/passwd'), /^[a-f0-9]{64}$/);
  assert.notEqual(objectFilename('r2', 'b', 'x'), objectFilename('supabase', 'b', 'x'));
  assert.throws(() => parseKey('weak-password'));
  const value = randomBytes(32).toString('base64'); assert.equal(parseKey(value).length, 32);
});
test('file versions keep destination, source and exact version identity', () => {
  const file = { provider: 'r2', bucket: 'docs', key: 'a.pdf', version: 'etag-1', bytes: 100 };
  assert.equal(versionKey(file), versionKey({ ...file }));
  for (const change of [{ provider: 'supabase' }, { bucket: 'other' }, { key: 'b.pdf' }, { version: 'etag-2' }, { bytes: 101 }])
    assert.notEqual(versionKey(file), versionKey({ ...file, ...change }));
});
