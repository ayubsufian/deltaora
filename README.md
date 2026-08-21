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
2. Start the application with Docker Compose:

```bash
docker compose up --build
```

The app will be available at `http://localhost`.

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
