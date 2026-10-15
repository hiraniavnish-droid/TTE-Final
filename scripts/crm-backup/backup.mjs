import { Client } from 'pg';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { encrypt, decrypt, sha256, parseKey, objectFilename, expiredBackup } from './archive.mjs';
import { fileURLToPath } from 'node:url';

export const PREFIX = '__tte-backups/v1/';
const CA_PATH = fileURLToPath(new URL('./supabase-ca.crt', import.meta.url));
const qi = name => `"${name.replaceAll('"', '""')}"`;
function required(name) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
export async function retry(operation, attempts = 3) {
  for (let i = 0; ; i++) {
    try { return await operation(); }
    catch (e) { if (i + 1 >= attempts) throw e; await new Promise(r => setTimeout(r, 1000 * 2 ** i)); }
  }
}
export async function listObjects(client, bucket, prefix) {
  const objects = []; let token;
  do {
    const page = await retry(() => client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token })));
    objects.push(...(page.Contents || [])); token = page.NextContinuationToken;
    if (page.IsTruncated && !token) throw new Error('Object listing was truncated without a continuation token');
  } while (token);
  return objects;
}
export function command(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { ...options, stdio: ['ignore', 'ignore', 'pipe'] });
    // Database tools can print customer values in errors. Keep those out of cloud logs.
    child.stderr.resume();
    child.on('error', () => reject(new Error(`${program} could not start`)));
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${program} failed (exit ${code})`)));
  });
}
function pgEnvironment(url) {
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: 'verify-full', PGSSLROOTCERT: CA_PATH, PGCONNECT_TIMEOUT: '20', PGAPPNAME: 'tte-readonly-backup',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=300000 -c lock_timeout=10000' };
}
function r2(access, secret) {
  return new S3Client({ endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`, region: 'auto', maxAttempts: 3,
    credentials: { accessKeyId: access, secretAccessKey: secret } });
}
async function downloadR2(client, bucket, object, path) {
  await retry(async () => {
    await rm(path, { force: true });
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: object.Key, IfMatch: object.ETag }));
    await pipeline(response.Body, createWriteStream(path, { flags: 'wx', mode: 0o600 }));
    if ((await stat(path)).size !== object.Size) throw new Error('R2 object size changed during backup');
  });
}
async function storageFetch(path, options = {}) {
  const response = await fetch(`${required('SUPABASE_URL')}/storage/v1/${path}`, { ...options, signal: AbortSignal.timeout(90000),
    headers: { apikey: required('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${required('SUPABASE_SERVICE_ROLE_KEY')}`, ...options.headers } });
  if (!response.ok) throw new Error(`Supabase Storage request failed (${response.status})`);
  return response;
}
export async function captureDatabase(client, databaseUrl, payload) {
    await client.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await client.query('select pg_export_snapshot() as snapshot, current_setting(\'server_version\') as version')).rows[0];
    const tables = (await client.query(`select n.nspname as schema, c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='r' and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1,2`)).rows;
    for (const table of tables) table.rows = Number((await client.query(`select count(*) from ${qi(table.schema)}.${qi(table.name)}`)).rows[0].count);
    const roles = (await client.query('select rolname from pg_roles order by rolname')).rows.map(x => x.rolname);
    await writeFile(join(payload, 'roles.json'), JSON.stringify(roles));
    const manifest = { format: 1, startedAt: new Date().toISOString(), serverVersion: snapshot.version,
      sourceCommit: process.env.GITHUB_SHA || 'local', tables, objects: [], supabaseBuckets: [],
      limitations: ['Logical database and uploaded-file backup, not point-in-time recovery.',
        'Vercel environment secrets and Supabase project settings require separate recovery/reconnection.',
        'Files are captured during the run; a changed or missing source object fails the run.'] };
    await command(process.env.PG_DUMP || 'pg_dump', ['--format=custom', '--snapshot', snapshot.snapshot,
      '--file', join(payload, 'database.dump')], { env: pgEnvironment(databaseUrl) });
    const exportDir = join(payload, 'crm-json'); await mkdir(exportDir);
    for (const table of tables.filter(x => ['public', 'velvet'].includes(x.schema))) {
      const rows = (await client.query(`select * from ${qi(table.schema)}.${qi(table.name)}`)).rows;
      await writeFile(join(exportDir, `${objectFilename('db', table.schema, table.name)}.json`), JSON.stringify({ schema: table.schema, table: table.name, rows }));
    }
    const storageObjects = (await client.query('select bucket_id, name, metadata, version from storage.objects order by bucket_id,name')).rows;
    manifest.supabaseBuckets = (await client.query('select * from storage.buckets order by id')).rows;
    await client.query('COMMIT'); await client.end();
    return { manifest, storageObjects, tables };
}
export async function main() {
  process.umask(0o077);
  const key = parseKey(required('BACKUP_KEY'));
  const databaseUrl = new URL(required('BACKUP_DATABASE_URL'));
  const sourceBucket = required('R2_SOURCE_BUCKET'), targetBucket = required('R2_BACKUP_BUCKET');
  const source = r2(required('R2_SOURCE_ACCESS_KEY_ID'), required('R2_SOURCE_SECRET_ACCESS_KEY'));
  const target = r2(required('R2_BACKUP_ACCESS_KEY_ID'), required('R2_BACKUP_SECRET_ACCESS_KEY'));
  const root = await mkdtemp(join(tmpdir(), 'tte-backup-'));
  const payload = join(root, 'payload'); await mkdir(join(payload, 'objects'), { recursive: true });
  const client = new Client({ host: databaseUrl.hostname, port: Number(databaseUrl.port || 5432),
    user: decodeURIComponent(databaseUrl.username), password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1), ssl: { rejectUnauthorized: true, ca: await readFile(CA_PATH, 'utf8') }, connectionTimeoutMillis: 20000,
    application_name: 'tte-readonly-backup', options: '-c default_transaction_read_only=on -c statement_timeout=300000 -c lock_timeout=10000' });
  let phase = 'database connection';
  try {
    phase = 'database snapshot';
    const { manifest, storageObjects, tables } = await captureDatabase(client, databaseUrl, payload);
    phase = 'R2 file backup';
    const sourceObjects = (await listObjects(source, sourceBucket)).filter(x => !x.Key.startsWith(PREFIX));
    for (const object of sourceObjects) {
      const filename = objectFilename('r2', sourceBucket, object.Key), path = join(payload, 'objects', filename);
      await downloadR2(source, sourceBucket, object, path);
      manifest.objects.push({ provider: 'r2', bucket: sourceBucket, key: object.Key, etag: object.ETag, bytes: object.Size,
        path: `objects/${filename}`, sha256: await sha256(path) });
    }
    phase = 'Supabase uploaded-file backup';
    for (const object of storageObjects) {
      const filename = objectFilename('supabase', object.bucket_id, object.name), path = join(payload, 'objects', filename);
      await retry(async () => {
        await rm(path, { force: true });
        const infoPath = `${encodeURIComponent(object.bucket_id)}/${object.name.split('/').map(encodeURIComponent).join('/')}`;
        const before = await (await storageFetch(`object/info/${infoPath}`)).json();
        // storage.objects metadata is in the DB snapshot; don't silently fetch a different file version.
        if (!object.version || before.version !== object.version) throw new Error('Supabase object changed since database snapshot');
        const response = await storageFetch(`object/${infoPath}`);
        await pipeline(response.body, createWriteStream(path, { flags: 'wx', mode: 0o600 }));
        if (object.metadata?.size != null && (await stat(path)).size !== Number(object.metadata.size)) throw new Error('Supabase object size mismatch');
        const after = await (await storageFetch(`object/info/${infoPath}`)).json();
        if (before.version !== after.version || before.etag !== after.etag || before.size !== after.size) throw new Error('Supabase object changed during download');
      });
      manifest.objects.push({ provider: 'supabase', bucket: object.bucket_id, key: object.name, metadata: object.metadata,
        bytes: (await stat(path)).size, path: `objects/${filename}`, sha256: await sha256(path) });
    }
    manifest.completedAt = new Date().toISOString();
    manifest.databaseSha256 = await sha256(join(payload, 'database.dump'));
    await writeFile(join(payload, 'manifest.json'), JSON.stringify(manifest, null, 2));
    phase = 'encryption';
    const tarball = join(root, 'backup.tar.gz'), encrypted = join(root, 'backup.ttebk');
    await command('tar', ['-czf', tarball, '-C', payload, '.']);
    await encrypt(tarball, encrypted, key);
    // Verify authenticated decryption before storing a success record.
    const verified = join(root, 'verify.tar.gz'); await decrypt(encrypted, verified, key);
    if (await sha256(tarball) !== await sha256(verified)) throw new Error('Encryption roundtrip failed');
    const checksum = await sha256(encrypted), bytes = (await stat(encrypted)).size;
    const name = `${manifest.completedAt.slice(0, 19).replaceAll(':', '')}Z-${randomBytes(6).toString('hex')}.ttebk`;
    const objectKey = `${PREFIX}${name}`;
    phase = 'offsite upload';
    await retry(() => target.send(new PutObjectCommand({ Bucket: targetBucket, Key: objectKey, Body: createReadStream(encrypted),
      ContentLength: bytes, ContentType: 'application/octet-stream', IfNoneMatch: '*', Metadata: { sha256: checksum } })));
    phase = 'offsite read-back verification';
    const download = await target.send(new GetObjectCommand({ Bucket: targetBucket, Key: objectKey }));
    const hash = createHash('sha256'); let downloadedBytes = 0;
    for await (const chunk of download.Body) { hash.update(chunk); downloadedBytes += chunk.length; }
    if (hash.digest('hex') !== checksum || downloadedBytes !== bytes) throw new Error('Offsite read-back checksum mismatch');
    const output = resolve(process.env.BACKUP_OUTPUT || join(tmpdir(), 'tte-backup-output'));
    await mkdir(output, { recursive: true, mode: 0o700 });
    // Only this encrypted artifact may be uploaded to GitHub. No plaintext goes into artifacts or git.
    await pipeline(createReadStream(encrypted), createWriteStream(join(output, name), { flags: 'wx', mode: 0o600 }));
    const summary = { status: 'verified', completedAt: manifest.completedAt, tables: tables.length,
      rows: tables.reduce((n, t) => n + t.rows, 0), files: manifest.objects.length, encryptedBytes: bytes, sha256: checksum };
    await writeFile(join(output, 'status.json'), JSON.stringify(summary, null, 2));
    phase = 'retention cleanup';
    const old = (await listObjects(target, targetBucket, PREFIX)).filter(o => expiredBackup(o.Key, PREFIX));
    for (const object of old) await target.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: object.Key }));
    console.log(JSON.stringify(summary));
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
      `Backup verified at ${summary.completedAt}.\n\n${summary.tables} database tables, ${summary.rows} rows, ${summary.files} files.\n\nEncrypted archive uploaded and downloaded again with a matching SHA-256 checksum.\n`, { flag: 'a' });
    return summary;
  } catch (error) {
    // Preserve only the phase and a safe error code, never SQL, file names, URLs, or customer data.
    throw new Error(`Backup failed during ${phase} (${error.code || error.name || 'error'})`);
  } finally {
    await client.end().catch(() => {}); source.destroy(); target.destroy();
    await rm(root, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });

export { required, qi, pgEnvironment, r2, downloadR2, storageFetch, CA_PATH };
