# Octee Airlines — Development and deployment

## Project settings

- **Source of truth:** GitHub repository [`zengbo0710/octee-airlines`](https://github.com/zengbo0710/octee-airlines), default branch `main`.
- **Hosting and runtime:** Cloudflare Workers, deployed by GitHub Actions with Wrangler.
- **Database:** Cloudflare D1 (SQLite), bound to the Worker as `DB`.
- **Free hostname:** [`https://octee-airlines.octee.workers.dev`](https://octee-airlines.octee.workers.dev). Cloudflare account subdomain: `octee`. This is a free Workers hostname, not a separately registered custom domain.
- **Worker name/prefix:** `octee-airlines`.
- **D1 database:** `octee-airlines-db` (`72f3d11b-1efc-4108-a713-3f0dff849cf6`), bound as `DB`.
- **Custom domain:** none configured. A custom domain requires a domain in a Cloudflare zone; use the free `workers.dev` hostname to start.

Cloudflare resources are provisioned in the connected Cloudflare account. The Worker is deployed and its free hostname is enabled. GitHub Actions has the required Cloudflare secrets configured, and the deployment workflow has completed successfully.

## Stack and layout

- `src/index.js` — Cloudflare Worker entry point.
- `wrangler.jsonc` — Worker name, runtime settings, D1 binding, and migration directory.
- `migrations/` — ordered SQL migrations applied to the remote D1 database.
- `.github/workflows/deploy.yml` — deploys the Worker from `main` after a push.

Keep application logic in the Worker and persist application data in D1 through the `DB` binding. Add schema changes as a new numbered migration; do not edit an already-applied migration.

## Cloudflare setup

1. The account `workers.dev` subdomain is `octee`; the deployed URL is `https://octee-airlines.octee.workers.dev`.
2. The D1 database `octee-airlines-db` has been created. Its ID is configured in `wrangler.jsonc`:

   **Database ID:** `72f3d11b-1efc-4108-a713-3f0dff849cf6`.

3. The one-year Cloudflare deploy token is scoped to the `octee-airlines` Worker. It has Workers Scripts Write, Account Settings Read, and Individual Workers Editor permissions. Its value is stored only in GitHub repository **Settings → Secrets and variables → Actions** as:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. GitHub Actions is enabled. Pushes to `main` deploy with Wrangler and the configured free `workers.dev` route. The workflow has succeeded after both secrets were added.

Do not commit API tokens or other secrets. The checked-in database ID is an identifier, not a credential.

## Local development

Requirements: Node.js and npm, plus access to a Cloudflare account for remote operations.

```sh
npm install --save-dev wrangler
npx wrangler dev
```

Wrangler starts the Worker locally and provides a local D1 database. To apply migrations locally:

```sh
npx wrangler d1 migrations apply octee-airlines-db --local
```

To inspect or deploy manually after Cloudflare authentication (`npx wrangler login`):

```sh
npx wrangler d1 migrations apply octee-airlines-db --remote
npx wrangler deploy
```

## CI/CD behavior

- A push to `main` runs `.github/workflows/deploy.yml` and deploys the current source to Cloudflare Workers.
- GitHub Actions uses `cloudflare/wrangler-action@v4`; the API token and account ID are read from GitHub Actions secrets.
- Remote D1 migrations are tracked in `migrations/`. Review schema changes before merging because production migrations affect the live database.
- The Worker and D1 database are provisioned in Cloudflare. Both required GitHub secrets are configured, and a deployment has succeeded.

## Free-tier notes

Cloudflare Workers and D1 have free usage plans, subject to current platform limits. D1 free usage includes daily row read/write limits and an account storage limit; requests or storage beyond free allowances may be unavailable until limits reset or may require an upgrade. Check the linked Cloudflare pricing documentation before production use.

## References

- [Cloudflare Workers GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Cloudflare `workers.dev` subdomains](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
