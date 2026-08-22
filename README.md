# Deltaora

AI-Powered Website Change Monitoring & Intelligent Policy Tracking Platform.

## Architecture

- **Frontend**: React 18, TypeScript, Vite, TanStack Query, Tailwind CSS 4
- **Backend**: Node.js, Express, TypeScript, BullMQ, Mongoose
- **Database**: MongoDB (Data storage), Redis (Caching & Job Queues)
- **AI**: Google Gemini 2.5 Flash (Change Summaries)
- **Infrastructure**: Docker Compose, Nginx (API Gateway & Static Hosting)

## Getting Started

1. Copy `.env.example` to `.env` and fill in values (especially `GEMINI_API_KEY`).
2. Start the local infrastructure with Docker Compose:

```bash
docker compose up -d
```

This starts MongoDB and Redis on localhost-only ports. Run the app with `pnpm run dev`.

## Local Development

If you prefer to run services outside of Docker for development:

```bash
# Start MongoDB and Redis
docker compose up mongodb redis -d

# Install dependencies
pnpm install

# Run all services (Frontend + Backend)
pnpm run dev
```

## Production Docker Compose

Production deploys use `compose.prod.yaml`. CI/CD should publish immutable image references, preferably digest-pinned GHCR images, and the production host should keep secrets in files rather than plain environment variables.

```bash
cp production.env.example production.env
# Edit production.env and create the secret files it references.
docker compose --env-file production.env -f compose.prod.yaml pull
docker compose --env-file production.env -f compose.prod.yaml up -d
```

## Password Breach Screening

Deltaora checks new, changed, and reset passwords against a breached-password blocklist. By default the server uses the Have I Been Pwned Pwned Passwords range API over HTTPS with k-anonymity response padding.

Production deployments must either allow outbound HTTPS from the API service to `https://api.pwnedpasswords.com/range` or set `PASSWORD_BREACH_SCREENING_MODE=local` and provide `PASSWORD_BREACH_SCREENING_LOCAL_DIR`. The local directory should contain prefix-sharded HIBP-style files named by the first five SHA-1 hash characters, for example `ABCDE.txt`, with `suffix:count` rows. Keep `PASSWORD_BREACH_SCREENING_FAILURE_POLICY=block` for production so password establishment fails closed when screening is unavailable.

## Workspaces

- `apps/client` - React frontend
- `apps/server` - Express backend & workers
- `packages/shared-types` - Shared TS interfaces
- `packages/validation` - Shared Zod schemas
- `packages/shared-utils` - Shared helpers
- `packages/config` - Shared constants
