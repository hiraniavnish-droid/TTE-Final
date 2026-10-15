import { Client } from 'pg';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, copyFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { captureDatabase, required, r2, downloadR2, storageFetch, CA_PATH, command, retry, listObjects, PREFIX } from './backup.mjs';
import { parseKey, encrypt, decrypt, sha256, objectFilename, expiredBackup } from './archive.mjs';

export function versionKey(object) { return JSON.stringify([object.provider, object.bucket, object.key, object.version, object.bytes]); }
async function readBack(client, bucket, key, expected) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = createHash('sha256');
  for await (const chunk of response.Body) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('Stored object checksum mismatch');
}
async function putVerified(client, bucket, key, path, immutable = true) {
  const bytes = (await stat(path)).size, checksum = await sha256(path);
  await retry(async () => {
    const params = { Bucket: bucket, Key: key, Body: createReadStream(path), ContentLength: bytes,
      ContentType: 'application/octet-stream', Metadata: { sha256: checksum } };
    if (bytes > 20 * 1024 * 1024) {
      // Large videos use retriable parts instead of restarting a single huge streamed request.
      // Blob keys contain a new random suffix; mutable catalog records are always small.
      await new Upload({ client, params, queueSize: 2, partSize: 8 * 1024 * 1024, leavePartsOnError: false }).done();
    } else await client.send(new PutObjectCommand({ ...params, ...(immutable ? { IfNoneMatch: '*' } : {}) }));
  });
  await readBack(client, bucket, key, checksum);
  return { bytes, checksum };
}
async function readCatalog(client, bucket, key, root, encryptionKey) {
  let response;
  try { response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })); }
  catch (error) { if (error.$metadata?.httpStatusCode === 404 || error.name === 'NoSuchKey') return { objects: [] }; throw error; }
  const encrypted = join(root, 'catalog.enc'), plain = join(root, 'catalog.json');
  await pipeline(response.Body, createWriteStream(encrypted, { flags: 'wx', mode: 0o600 }));
  await decrypt(encrypted, plain, encryptionKey);
  const catalog = JSON.parse(await readFile(plain, 'utf8'));
  if (catalog.format !== 2 || !Array.isArray(catalog.objects)) throw new Error('Invalid backup catalog');
  return catalog;
}
async function saveCatalog(client, bucket, key, catalog, root, encryptionKey) {
  const plain = join(root, 'catalog-new.json'), encrypted = join(root, 'catalog-new.enc');
  try {
    await writeFile(plain, JSON.stringify(catalog)); await encrypt(plain, encrypted, encryptionKey);
    await putVerified(client, bucket, key, encrypted, false);
  } finally { await rm(plain, { force: true }); await rm(encrypted, { force: true }); }
}

export async function main() {
  process.umask(0o077);
  const encryptionKey = parseKey(required('BACKUP_KEY')), url = new URL(required('BACKUP_DATABASE_URL'));
  const keyId = createHash('sha256').update(encryptionKey).digest('hex').slice(0, 16);
  const sourceBucket = required('R2_SOURCE_BUCKET'), bucket = required('R2_BACKUP_BUCKET');
  const source = r2(required('R2_SOURCE_ACCESS_KEY_ID'), required('R2_SOURCE_SECRET_ACCESS_KEY'));
  const target = r2(required('R2_BACKUP_ACCESS_KEY_ID'), required('R2_BACKUP_SECRET_ACCESS_KEY'));
  const root = await mkdtemp(join(tmpdir(), 'tte-incremental-')), payload = join(root, 'payload');
  await mkdir(payload);
  const client = new Client({ host: url.hostname, port: Number(url.port || 5432), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.slice(1), ssl: { rejectUnauthorized: true, ca: await readFile(CA_PATH, 'utf8') },
    connectionTimeoutMillis: 20000, application_name: 'tte-readonly-backup',
    options: '-c default_transaction_read_only=on -c statement_timeout=300000 -c lock_timeout=10000' });
  let phase = 'database snapshot';
  try {
    console.log('Capturing a consistent database snapshot.');
    const { manifest, storageObjects, tables } = await captureDatabase(client, url, payload);
    manifest.format = 2;
    manifest.limitations.push('File versions reside in encrypted R2 blobs referenced by each dated database snapshot. Retained blobs must not be deleted.');
    phase = 'previous backup catalog';
    const catalogKey = `${PREFIX}catalog/${keyId}.ttebk`;
    const previous = await readCatalog(target, bucket, catalogKey, root, encryptionKey);
    const known = new Map(previous.objects.map(object => [versionKey(object), object]));
    let seed = new Map();
    if (process.env.BACKUP_SEED_DIRECTORY) {
      const baseline = JSON.parse(await readFile(join(process.env.BACKUP_SEED_DIRECTORY, 'manifest.json'), 'utf8'));
      seed = new Map(baseline.objects.map(x => [JSON.stringify([x.provider, x.bucket, x.key]), x]));
    }
    phase = 'file inventory';
    const r2Objects = (await listObjects(source, sourceBucket)).filter(x => !x.Key.startsWith(PREFIX));
    const objects = [
      ...r2Objects.map(x => ({ provider: 'r2', bucket: sourceBucket, key: x.Key, version: x.ETag, bytes: x.Size, source: x })),
      ...storageObjects.map(x => ({ provider: 'supabase', bucket: x.bucket_id, key: x.name, version: x.version, bytes: Number(x.metadata?.size), metadata: x.metadata, source: x })),
    ];
    let uploaded = 0, reused = 0;
    const checkStoredFiles = new Date().getUTCDay() === 0 || process.env.BACKUP_VERIFY_ALL === '1';
    console.log(`Checking ${objects.length} uploaded-file versions. Unchanged files will be reused.`);
    phase = 'encrypted file versions';
    for (const [index, object] of objects.entries()) {
      if (!object.version || !Number.isFinite(object.bytes)) throw new Error('Source file version/size missing');
      const cached = known.get(versionKey(object));
      if (cached) {
        let exists = false;
        try {
          const head = await target.send(new HeadObjectCommand({ Bucket: bucket, Key: cached.blobKey }));
          exists = head.ContentLength === cached.encryptedBytes && head.Metadata?.sha256 === cached.encryptedSha256;
        } catch (error) { if (error.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound') throw error; }
        if (exists) {
          if (checkStoredFiles) await readBack(target, bucket, cached.blobKey, cached.encryptedSha256);
          manifest.objects.push(cached); reused++;
          continue;
        }
      }
      const local = join(root, `file-${index}`), encrypted = `${local}.ttebk`;
      const baseline = seed.get(JSON.stringify([object.provider, object.bucket, object.key]));
      const seededVersion = baseline && (object.provider === 'r2' ? baseline.etag : baseline.metadata?.eTag);
      const currentVersion = object.provider === 'r2' ? object.version : object.metadata?.eTag;
      if (baseline && seededVersion && seededVersion === currentVersion && baseline.bytes === object.bytes) {
        await copyFile(join(process.env.BACKUP_SEED_DIRECTORY, baseline.path), local);
        if (await sha256(local) !== baseline.sha256) throw new Error('Seed checksum mismatch');
      } else if (object.provider === 'r2') {
        await downloadR2(source, sourceBucket, object.source, local);
      } else {
        const path = `${encodeURIComponent(object.bucket)}/${object.key.split('/').map(encodeURIComponent).join('/')}`;
        await retry(async () => {
          await rm(local, { force: true });
          const before = await (await storageFetch(`object/info/${path}`)).json();
          if (before.version !== object.version) throw new Error('Source file changed since snapshot');
          const response = await storageFetch(`object/${path}`);
          await pipeline(response.body, createWriteStream(local, { flags: 'wx', mode: 0o600 }));
          const after = await (await storageFetch(`object/info/${path}`)).json();
          if (before.version !== after.version || before.etag !== after.etag || before.size !== after.size) throw new Error('Source file changed during backup');
        });
      }
      if ((await stat(local)).size !== object.bytes) throw new Error('Source file size mismatch');
      await encrypt(local, encrypted, encryptionKey);
      const blobKey = `${PREFIX}blobs/${keyId}/${objectFilename('version', object.bucket, versionKey(object))}-${randomBytes(6).toString('hex')}.ttebk`;
      const result = await putVerified(target, bucket, blobKey, encrypted);
      const { source: ignored, ...metadata } = object;
      manifest.objects.push({ ...metadata, blobKey, sha256: await sha256(local), encryptedBytes: result.bytes, encryptedSha256: result.checksum });
      known.set(versionKey(object), manifest.objects.at(-1));
      await rm(local); await rm(encrypted); uploaded++;
      if (uploaded % 25 === 0) {
        // A partial progress catalog only reuses already verified file versions. It is not
        // a successful database snapshot; publishing a dated snapshot still happens at the end.
        await saveCatalog(target, bucket, catalogKey, { format: 2, status: 'files-in-progress', objects: [...known.values()] }, root, encryptionKey);
        console.log(`${uploaded} changed/new files stored and verified.`);
      }
    }
    phase = 'database encryption';
    manifest.completedAt = new Date().toISOString();
    manifest.databaseSha256 = await sha256(join(payload, 'database.dump'));
    await writeFile(join(payload, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const tarball = join(root, 'snapshot.tar.gz'), encrypted = join(root, 'snapshot.ttebk'), roundtrip = join(root, 'roundtrip.tar.gz');
    await command('tar', ['-czf', tarball, '-C', payload, '.']);
    await encrypt(tarball, encrypted, encryptionKey); await decrypt(encrypted, roundtrip, encryptionKey);
    if (await sha256(tarball) !== await sha256(roundtrip)) throw new Error('Snapshot decryption failed');
    const name = `${manifest.completedAt.slice(0, 19).replaceAll(':', '')}Z-${randomBytes(6).toString('hex')}.ttebk`;
    const snapshotKey = `${PREFIX}snapshots/${name}`;
    phase = 'database upload and read-back';
    const result = await putVerified(target, bucket, snapshotKey, encrypted);
    phase = 'catalog publication';
    await saveCatalog(target, bucket, catalogKey, { ...manifest, snapshotKey }, root, encryptionKey);
    const output = resolve(process.env.BACKUP_OUTPUT || join(tmpdir(), 'tte-backup-output'));
    await mkdir(output, { recursive: true, mode: 0o700 });
    await copyFile(encrypted, join(output, name));
    const summary = { status: 'verified', format: 2, completedAt: manifest.completedAt, tables: tables.length,
      rows: tables.reduce((n, t) => n + t.rows, 0), files: objects.length, newFiles: uploaded, reusedFiles: reused,
      snapshotBytes: result.bytes, sha256: result.checksum, verifiedAllStoredFiles: checkStoredFiles };
    await writeFile(join(output, 'status.json'), JSON.stringify(summary, null, 2));
    phase = 'snapshot retention';
    // File blobs are deliberately retained: deleting a source file must not delete a backup.
    // Garbage collection needs the union of references in all retained snapshots and is separate.
    const snapshots = await listObjects(target, bucket, `${PREFIX}snapshots/`);
    for (const snapshot of snapshots.filter(x => expiredBackup(x.Key, `${PREFIX}snapshots/`)))
      await target.send(new DeleteObjectCommand({ Bucket: bucket, Key: snapshot.Key }));
    console.log(JSON.stringify(summary));
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY,
      `Verified backup at ${summary.completedAt}.\n\n${summary.tables} database tables, ${summary.rows} rows and ${summary.files} file versions.\n\n${summary.newFiles} new/changed files copied; ${summary.reusedFiles} unchanged files reused.\n\nEncrypted database snapshots: R2 30 days; secondary GitHub copy 30 days. File versions remain in R2.\n`, { flag: 'a' });
    return summary;
  } catch (error) { throw new Error(`Backup failed during ${phase} (${error.code || error.name || 'error'})`); }
  finally { await client.end().catch(() => {}); source.destroy(); target.destroy(); await rm(root, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
