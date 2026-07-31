# Deltaora

AI-Powered Website Change Monitoring & Intelligent Policy Tracking Platform.

## Architecture

- **Frontend**: React 19, TypeScript, Vite, TanStack Query, Tailwind CSS 4
- **Backend**: Node.js, Express, TypeScript, BullMQ, Mongoose
- **Database**: MongoDB (Data storage), Redis (Caching & Job Queues)
- **AI**: Google Gemini 1.5 Flash (Change Summaries)
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

## Workspaces

- `apps/client` - React frontend
- `apps/server` - Express backend & workers
- `packages/shared-types` - Shared TS interfaces
- `packages/validation` - Shared Zod schemas
- `packages/shared-utils` - Shared helpers
- `packages/config` - Shared constants
