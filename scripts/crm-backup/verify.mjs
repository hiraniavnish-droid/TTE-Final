import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { decrypt, parseKey, sha256, objectFilename } from './archive.mjs';
import { command } from './backup.mjs';
import { fileURLToPath } from 'node:url';

export async function unpackVerified(archive, key, directory) {
  const tarball = join(directory, 'verified.tar.gz');
  await decrypt(archive, tarball, key);
  // Authenticate first; reject unsafe paths before extracting anything.
  const listing = await new Promise((resolve, reject) => {
    const child = spawn('tar', ['-tzf', tarball], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', b => output += b); child.stderr.resume();
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve(output.trim().split('\n')) : reject(new Error('Invalid tar archive')));
  });
  for (const entry of listing) {
    if (entry.startsWith('/') || entry.split('/').includes('..') || entry.includes('\\')) throw new Error('Unsafe archive entry');
  }
  await command('tar', ['-xzf', tarball, '-C', directory]);
  await rm(tarball);
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  if (![1, 2].includes(manifest.format) || !Array.isArray(manifest.objects) || !Array.isArray(manifest.tables)) throw new Error('Unsupported manifest');
  if (await sha256(join(directory, 'database.dump')) !== manifest.databaseSha256) throw new Error('Database dump checksum failed');
  for (const object of manifest.objects) {
    if (manifest.format === 2) {
      if (!object.blobKey?.startsWith('__tte-backups/v1/blobs/') || !/^[a-f0-9]{64}$/.test(object.sha256) || !/^[a-f0-9]{64}$/.test(object.encryptedSha256)) throw new Error('Invalid file-version reference');
      continue;
    }
    if (object.path !== `objects/${objectFilename(object.provider, object.bucket, object.key)}`) throw new Error('Invalid object path');
    if (await sha256(join(directory, object.path)) !== object.sha256) throw new Error('Uploaded-file checksum failed');
  }
  const jsonFiles = await readdir(join(directory, 'crm-json'));
  const exported = manifest.tables.filter(t => ['public', 'velvet'].includes(t.schema));
  if (jsonFiles.length !== exported.length) throw new Error('CRM export table count mismatch');
  for (const table of exported) {
    const data = JSON.parse(await readFile(join(directory, 'crm-json', `${objectFilename('db', table.schema, table.name)}.json`), 'utf8'));
    if (data.schema !== table.schema || data.table !== table.name || data.rows.length !== table.rows) throw new Error('CRM export row count mismatch');
  }
  return manifest;
}
async function main() {
  process.umask(0o077);
  if (!process.argv[2]) throw new Error('Usage: BACKUP_KEY=... node verify.mjs /path/to/archive.ttebk');
  const directory = await mkdtemp(join(tmpdir(), 'tte-verify-'));
  try {
    const manifest = await unpackVerified(resolve(process.argv[2]), parseKey(process.env.BACKUP_KEY), directory);
    console.log(JSON.stringify({ status: 'archive-verified', completedAt: manifest.completedAt, tables: manifest.tables.length, files: manifest.objects.length,
      fileContentsVerified: manifest.format === 1,
      note: manifest.format === 1 ? 'Verified decryption, dump checksum, file checksums and CRM JSON row counts. A database restore drill is separate.' :
        'Verified database snapshot and file-version index. Encrypted file contents must be fetched from R2 and verified separately.' }));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
