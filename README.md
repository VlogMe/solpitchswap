# SolPitch Graduated Listings Platform

Fresh React/Vite/TypeScript application with a Cloudflare Worker API and D1 database.

## Implemented

- Three-column graduated-project directory
- Onyx project detail view
- Public graduated-coin submission form
- D1-backed submission storage
- Protected admin login with an HttpOnly session cookie
- Admin queue with approve/reject decisions and reviewer notes
- Optional server-side Cloudflare Turnstile validation
- Prepared D1 statements and server-side input validation
- Search, badges, promoted placements, rankings and compact swap panel

## Listing rule

Only graduated or bonded Solana projects are accepted. No presales, upcoming launches or unbonded tokens.

## Local setup

```bash
npm install
npm run db:migrate:local
npm run api:dev
npm run dev
```

Set `VITE_API_BASE_URL` in `.env.local` when the API is served from a different origin.

## Cloudflare provisioning

1. Create the database:

```bash
npx wrangler d1 create solpitch-listings
```

2. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc` with the returned database ID.

3. Add secrets:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put TURNSTILE_SECRET
```

`TURNSTILE_SECRET` is optional until the browser widget is added. When configured, every public submission must contain a valid Turnstile token.

4. Apply the migration and deploy:

```bash
npm run db:migrate:remote
npm run api:deploy
```

5. Set the frontend API URL:

```bash
VITE_API_BASE_URL=https://solpitch-listings-api.<account>.workers.dev
```

6. Update `ALLOWED_ORIGIN` in `wrangler.jsonc` to the exact production frontend origin before deployment.

## Security design

- Admin passwords are stored only as Worker secrets.
- Successful login creates a random server-side session stored as a SHA-256 hash in D1.
- The browser receives an `HttpOnly`, `Secure`, `SameSite=Strict` cookie.
- Admin endpoints require a valid unexpired session.
- Public inputs are validated on the server and inserted through bound prepared statements.
- Turnstile validation is performed server-side when enabled.

## Swap safety boundary

The existing Jupiter, Phantom, Buffer, RPC, signing and transaction code is not included or modified. The sidebar continues to link to the proven live swap at https://solpitch.net.
