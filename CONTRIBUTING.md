# Contributing to TTE CRM

## Start from the current GitHub version

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/describe-your-change
```

Use a fresh clone if an older local folder contains unrelated uncommitted work.
Do not replace the current GitHub version with an old local snapshot.

## Make and check a change

1. Make the change on your feature branch.
2. Run `npm ci` when setting up a checkout or after dependency changes.
3. Run `npm run build` and the verification scripts relevant to your change.
4. Review `git diff` and stage only the intended files.
5. Commit and push your branch:

```sh
git add path/to/changed-file
git commit -m "Describe the resulting behavior"
git push -u origin feature/describe-your-change
```

Open a pull request on GitHub targeting `main`. Explain what changed and how it
was checked. Review the Vercel deployment check and preview where available.
Preview behavior depends on the environment variables configured for Preview
in Vercel; production-only integrations may not be configured there.

## Release

The repository owner reviews and merges the pull request. Vercel automatically
builds `main` and updates https://ttecrm.vercel.app after a successful production
deployment. A direct push to `main` also triggers production, so use feature
branches for work that is not ready to release.

In Vercel's `ttecrm` project, check that the deployment is Ready, comes from
GitHub `main`, and shows the intended commit. Open the affected CRM page after
deployment. The existing production environment variables and integration URLs
remain in the Vercel project.

For a bad release, revert the offending commit through GitHub and merge the
revert to `main`. This publishes the correction through the same deployment
flow. Vercel also provides rollback controls for urgent recovery.

## Credentials and generated files

- Keep secrets in Vercel or a local ignored environment file.
- Do not commit database exports, customer quotations, backup archives, or logs.
- Database changes have a separate migration process; a Git push does not apply
  database migrations automatically.
- Serverless route changes are deployed by Vercel; `npm run dev` alone runs only
  the Vite frontend.

To add another editor, invite their own GitHub account from the repository's
collaborator settings. New collaborators must accept the invitation.
