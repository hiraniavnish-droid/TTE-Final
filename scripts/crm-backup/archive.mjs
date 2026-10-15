import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('TTEBKP1\n');
export function parseKey(value) {
  const key = Buffer.from(value || '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== value) throw new Error('BACKUP_KEY must be a 32-byte base64 key');
  return key;
}
export async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function encrypt(source, target, key) {
  const nonce = randomBytes(12);
  const header = Buffer.concat([MAGIC, nonce]);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(header);
  await writeFile(target, header, { flag: 'wx', mode: 0o600 });
  try {
    await pipeline(createReadStream(source), cipher, createWriteStream(target, { flags: 'a' }));
    await appendFile(target, cipher.getAuthTag());
  } catch (error) { await rm(target, { force: true }); throw error; }
}
export async function decrypt(source, target, key) {
  const length = (await stat(source)).size;
  if (length < MAGIC.length + 12 + 16) throw new Error('Invalid backup archive');
  const handle = await open(source, 'r');
  const header = Buffer.alloc(MAGIC.length + 12), tag = Buffer.alloc(16);
  try { await handle.read(header, 0, header.length, 0); await handle.read(tag, 0, 16, length - 16); }
  finally { await handle.close(); }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unknown archive version');
  const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(MAGIC.length));
  decipher.setAAD(header); decipher.setAuthTag(tag);
  try {
    await pipeline(createReadStream(source, { start: header.length, end: length - 17 }), decipher, createWriteStream(target, { flags: 'wx', mode: 0o600 }));
  } catch (error) { await rm(target, { force: true }); throw error; }
}
export function objectFilename(provider, bucket, name) {
  return createHash('sha256').update(JSON.stringify([provider, bucket, name])).digest('hex');
}
export function expiredBackup(key, prefix, now = new Date(), days = 30) {
  if (!prefix || !prefix.endsWith('/') || !key.startsWith(prefix)) return false;
  const tail = key.slice(prefix.length);
  // Never delete arbitrary objects, even if they share our prefix.
  if (!/^\d{4}-\d{2}-\d{2}T\d{6}Z-[a-f0-9]{12}\.ttebk$/.test(tail)) return false;
  const date = new Date(`${tail.slice(0, 13)}:${tail.slice(13, 15)}:${tail.slice(15, 17)}Z`);
  return now.getTime() - date.getTime() > days * 86400000;
}
