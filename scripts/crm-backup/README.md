# TTE CRM temporary backup

This is a cloud backup worker, independent of the CRM's lead-save and MAX/webhook paths.
The production schedule lives in the private repository `hiraniavnish-droid/tte-crm-backups`.
Its workflow template is `workflow-template.yml`; activating it requires that file at
`.github/workflows/daily-backup.yml` on the private repository's default branch.

## What it saves

- A PostgreSQL 17 custom-format dump, including schema, table data, sequences, policies and grants.
  A repeatable-read exported snapshot keeps the dump and row-count manifest consistent.
- A JSON export of every table in the `public` and `velvet` schemas, inside the encrypted snapshot.
- Every file in the CRM's R2 source bucket, plus every file recorded in Supabase Storage.
  New/changed versions are encrypted separately. Dated snapshots contain the exact version index.
- Database role names, bucket metadata, file hashes and the source code revision.

The scheduled command is `npm run backup` (incremental.mjs). `npm run backup:full` is a
manual, standalone full archive including file contents. It is intentionally not the daily job.

## Schedule and controls

Daily at **03:17 Asia/Kolkata** (`47 21 * * *` UTC); GitHub can delay scheduled runs.
Open GitHub → this private repository → Actions → **TTE CRM daily encrypted backup**.
**Run workflow** runs it now. The workflow's `…` menu → **Disable workflow** pauses it;
**Enable workflow** resumes it. Each run has a summary showing the verified date, rows,
file count, new files and reused files. A failed run remains red; inspect its failed phase.
GitHub Actions notifications follow the owner's GitHub notification settings. No MAX,
Interakt, WhatsApp or other notification webhook is called.

## Retention and costs

Database snapshots are retained **30 days in R2**, with a second encrypted database snapshot
in GitHub Actions artifacts for **30 days**. File versions stay in R2; they are not copied into
GitHub's database-only artifact. Old file versions are deliberately not automatically deleted,
so deleting a source attachment does not erase its backup. Review storage growth while using
this temporary arrangement. The first file copy is larger; unchanged files are reused thereafter.
Every Sunday the job re-downloads and checks all referenced encrypted R2 file blobs.

This does not require a paid Supabase plan. Existing R2/GitHub usage quotas still apply;
free storage/egress cannot be guaranteed indefinitely as the business grows. The current
source files total roughly 600 MB; database snapshots are approximately 8 MB each.

## Security and current limits

- AES-256-GCM authenticated encryption; the 32-byte recovery key is held outside the CRM.
- TLS certificate and hostname verification use Supabase's published root CA. Its source is
  Supabase Studio's `ssl:certificate_url` template. SHA-256 fingerprint:
  `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.
- PostgreSQL login `tte_backup_reader` has `pg_read_all_data` plus BYPASSRLS to include
  private rows. It has no table write or public-schema CREATE grants, a three-connection
  limit, read-only default transactions and five-minute statement/idle-transaction limits.
- Source R2 credentials and Supabase's service-role key are also needed to download private
  attachments. These are privileged credentials, stored only as encrypted GitHub Actions
  secrets; the worker only reads source files. Restrict access to the private backup repository.
- The reserved R2 namespace is `__tte-backups/v1/`; it is excluded from source-file inventory.
  The temporary target shares the current document bucket because the saved Cloudflare
  management token is expired. App credentials could therefore delete these backups.
  A separate private bucket with scoped credentials and bucket locks is the next hardening step.
- The secondary GitHub copy protects database recovery if Cloudflare is lost; recovery of
  uploaded file contents still requires the R2 backup blobs or a standalone full baseline.
- These are logical snapshots, **not point-in-time recovery**. After a failure, changes since
  the last successful run may be lost. File stores cannot share a database transaction;
  detected changes during download fail the run rather than silently save mismatched data.
- Vercel environment secrets, Supabase platform settings and encryption root keys are not
  exported. Keep these separately in a password manager. Google Contacts may need reconnecting
  if its Vercel encryption key is lost. Do not restore queued outbound events into a live app
  before pausing MAX, relay, payment and Contacts workers.

## Recovery

Keep a separate secure copy of `BACKUP_KEY`; losing it makes the archives unreadable.
The initial owner-only recovery configuration is at
`/Users/avnish/.codex/private/tte-crm-backup-recovery.json` on Avnish's Mac.
It contains secrets and must never be attached to chat, committed to git or emailed.

1. Download a dated encrypted snapshot from GitHub Actions artifacts or R2.
2. Set BACKUP_KEY through a secure environment and run `node verify.mjs /path/to/snapshot.ttebk`.
   Format 1 checks all embedded files; format 2 checks the database and file-version index.
3. Decrypt into a private directory. Use manifest.json to download the format-2 `blobKey` files
   from R2. Verify `encryptedSha256`, decrypt with the same key, then verify plaintext `sha256`.
   `provider`, `bucket` and `key` identify where each file belongs.
4. Restore `database.dump` into an **isolated** compatible Supabase/PostgreSQL environment first.
   Restore roles/extensions as needed, preserving app grants and policies. Compare every table's
   row count to the manifest. Never automatically restore over the production database.
5. Restore files to their recorded paths. Reconfigure project settings/secrets, pause event
   workers, verify payments/leads, and only then deliberately switch the app to the recovered DB.

PostgreSQL tools must be version 17 or newer. Supabase's official recovery notes apply when
restoring into a fresh managed project: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
