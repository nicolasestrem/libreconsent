# @libreconsent/worker-log

Optional Cloudflare Worker and D1 audit trail for explicit libreconsent
decisions. It has no shipped runtime npm dependencies, is not required by core,
and stores no IP address, user agent, request header, region, fingerprint, or
service-level choice.

## v1 release contract

`1.0.0` is a release candidate and is not yet published. After publication,
install with:

```sh
pnpm add @libreconsent/worker-log
pnpm add -D wrangler
```

The package-root ESM/default export and public TypeScript declarations are the
only module API; deep imports are unsupported.

The packaged example deploys the built `dist/index.js`, and `prepack` rebuilds
that artifact. The tarball includes only the ESM bundle, declarations,
migration, example Wrangler configuration, README, LICENSE, and package
manifest. It includes no account-specific Wrangler file, test, spec, or secret.
This is a Cloudflare Worker module rather than browser code, so it intentionally
ships no IIFE global and has no browser-support contract.

## What it accepts

`POST /receipt` accepts the exact core payload:

```json
{
  "consentId": "550e8400-e29b-41d4-a716-446655440000",
  "host": "example.com",
  "revision": 1,
  "categories": { "necessary": true, "analytics": false },
  "ts": "2026-07-27T10:00:00.000Z",
  "action": "consent"
}
```

The request must:

- carry an exact configured `Origin`; missing, `null`, and unlisted origins are
  rejected without CORS headers;
- have a payload `host` equal to that Origin's host;
- use `Content-Type: application/json` and stay at or below 16 KiB;
- contain no unknown fields and pass strict UUIDv4, positive-integer revision,
  boolean-category, ISO timestamp, and action validation.

Allowed origins receive CORS headers. A successful insert returns
`201 {"stored":true}`. The `RECEIPT_RATE_LIMITER` binding permits 30 requests
per minute for each `Origin + consentId`; excess requests return 429. Cloudflare
rate limiting is deliberately permissive/eventually consistent and scoped per
Cloudflare location, so it is abuse resistance rather than a global accounting
limit. Its key contains no IP address.

`GET /receipts/:consentId` requires
`Authorization: Bearer <AUDIT_BEARER_TOKEN>`. It returns the consent ID and its
ascending receipt trail; an unknown valid ID has an empty trail. The internal
numeric row ID is never returned. Every JSON response carries
`Cache-Control: no-store`.

The example explicitly disables Workers observability. Do not enable invocation
logging for this Worker: request URLs contain consent IDs and retrieval headers
contain the bearer credential. D1 is the intentionally minimal audit store.

## Deploy

Requirements: a Cloudflare account with Workers, D1, and Rate Limiting
bindings, plus a current authenticated Wrangler.

1. Create the database:

   ```sh
   pnpm exec wrangler d1 create libreconsent-worker-log
   ```

2. Create a deployment directory in your application. Copy the installed
   package's `dist/`, `migrations/`, and `wrangler.example.jsonc` into it, then
   rename the configuration to `wrangler.jsonc`. Keep those three paths
   together because the configuration intentionally resolves
   `dist/index.js` and `migrations/` relative to itself.

   Set the returned D1 `database_id`, choose an unused numeric rate-limit
   `namespace_id`, and replace `ALLOWED_ORIGINS` with a comma-separated list
   of exact HTTP(S) origins. Keep account IDs and deployment-specific
   configuration out of version control.

3. Set the bearer secret. Do not put it in Wrangler configuration:

   ```sh
   pnpm exec wrangler secret put AUDIT_BEARER_TOKEN --config worker-log/wrangler.jsonc
   ```

4. Apply the tracked migrations and deploy:

   ```sh
   pnpm exec wrangler d1 migrations apply DB --remote --config worker-log/wrangler.jsonc
   pnpm exec wrangler deploy --config worker-log/wrangler.jsonc
   ```

   The installed tarball already contains the built Worker. Contributors
   deploying from this repository instead run
   `pnpm --filter @libreconsent/worker-log build`, copy
   `packages/worker-log/wrangler.example.jsonc` to the ignored
   `packages/worker-log/wrangler.local.jsonc`, and use that config path for
   the same secret, migration, and deployment commands.

5. Configure core with the complete deployed target. Core does not append a
   path:

   ```ts
   init({
     ...config,
     receiptEndpoint: "https://receipts.example.com/receipt",
   });
   ```

Retrieve a trail with:

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $AUDIT_BEARER_TOKEN" \
  "https://receipts.example.com/receipts/550e8400-e29b-41d4-a716-446655440000"
```

The daily `0 0 * * *` UTC trigger deletes rows older than `RETENTION_DAYS`
using server-controlled `received_at`. The default is 395 days; configuration
accepts integers from 1 through 3650. The client timestamp is audit data and is
never the purge clock.

## Local and remote verification

The normal suite uses Cloudflare's Vitest integration with isolated Miniflare
storage, a real D1 binding, and the tracked migration:

```sh
pnpm --filter @libreconsent/worker-log test
```

The account test is manual and excluded from ordinary CI. Create the ignored
`wrangler.test-account.jsonc` from the example and point it at dedicated
non-production Worker/D1 resources. Keep the required `DB` binding name, use
any database name you chose for that resource, and add `"remote": true` to
that D1 binding in this ignored test-only config. This is what makes the local
scheduled handler purge the same remote row that the deployed Worker stored;
do not add it to the reusable deployment example, where an ordinary
`wrangler dev` should remain local by default.

Set:

```sh
export LIBRECONSENT_WORKER_LOG_URL="https://your-test-worker.workers.dev"
export LIBRECONSENT_WORKER_LOG_ORIGIN="https://your-allowed-test-origin.example"
export LIBRECONSENT_WORKER_LOG_TOKEN="your-untracked-bearer-secret"
pnpm test:worker-log:remote
```

That command applies migrations, deploys, posts and retrieves a unique receipt,
then starts Wrangler development with the required `DB` binding connected to
the configured remote D1 database. The migration command targets that binding,
so custom test database names work. It invokes Wrangler's scheduled-handler
test route with a future `time` and proves the deployed retrieval endpoint is
empty. There is no test-only purge HTTP route.

## Security, privacy, and support

The Worker stores the documented consent receipt fields only: no IP, user
agent, request headers, fingerprint, region, or service choices. Responses are
`no-store` and the example disables observability. The service is an audit aid,
not proof that the notice or user interface was legally compliant. Cloudflare
Workers compatibility is the runtime target; browser support belongs to the
core/UI/bridge packages.
