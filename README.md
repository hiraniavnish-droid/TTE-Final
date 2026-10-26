# The Tourism Experts CRM

This repository is the source for the live TTE CRM.

| Item | Location |
| --- | --- |
| Live CRM | https://ttecrm.vercel.app |
| GitHub repository | https://github.com/hiraniavnish-droid/TTE-Final |
| GitHub owner | `hiraniavnish-droid` |
| Production branch | `main` |
| Vercel project | `ttecrm` |
| Runtime | Node.js 24.x |

## How a change goes live

```text
Team member edits a feature branch
  -> opens a pull request on GitHub
  -> Vercel builds a preview
  -> owner reviews and merges into main
  -> Vercel builds and publishes the live CRM
```

Vercel is connected directly to this repository. Pushing or merging into `main`
starts the production deployment; nobody needs to upload the app from a personal
computer. Check the deployment result before treating a change as live.

The hosted CRM serves its APIs, WhatsApp/Interakt integrations, scheduled workers,
and quotation assets from the same Vercel project. Their server-side configuration
stays in Vercel. WhatsApp itself is not a separate deployment target.

`rannutsavtickets.in` is a separate website and Vercel project. This repository
does not deploy that website. Changes to its own webhook handlers must be made
in its repository.

## Give a teammate editing access

The repository owner can invite a teammate from
[Settings -> Collaborators](https://github.com/hiraniavnish-droid/TTE-Final/settings/access).
The teammate must accept the invitation before they can push a branch to this
repository. Share this repository link with them, not your GitHub password or
production credentials.

The repository is currently public, so people can read and clone it without an
invitation. Writing to this repository still requires collaborator access.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, pull requests, and deployment
verification.

## Run locally

Use Node.js 24.x and npm:

```sh
git clone https://github.com/hiraniavnish-droid/TTE-Final.git
cd TTE-Final
npm ci
```

Ask the project owner for the approved development environment configuration
and save it in `.env.local`. Developers with Vercel project access can pull that
configuration instead:

```sh
npx vercel link
# Select the existing ttecrm project, not a new project.
npx vercel env pull .env.local --environment development
```

```sh
npm run dev
```

The frontend runs at http://localhost:3000. Use `npx vercel dev` when working on
the serverless API routes as well.

## Build

```sh
npm run build
```

The build first compiles the bot/automation API entrypoints, then builds the Vite
frontend into `dist/`. Vercel runs this build for Git deployments.

## Code map

- `pages/`, `components/`, `contexts/`: CRM screens and shared frontend state.
- `api/`: Vercel serverless handlers and integration entrypoints.
- `lib/`, `services/`: shared logic, pricing, integrations, and quotation generation.
- `public/`: deployed brochures, videos, photos, and fonts used by the CRM.
- `scripts/`: build tools and feature verification scripts.
- `docs/`: module and integration documentation, including
  [the deployed-module audit](docs/DEPLOYED_MODULES.md).
- `vercel.json`: routing, response headers, and scheduled jobs.

Production secrets and customer exports do not belong in Git. Environment files,
local backups, temporary files, and generated customer quotations are excluded
from commits. Keep production configuration in the existing Vercel project.
