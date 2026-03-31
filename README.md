# SST

SST is a monorepo starter for a server-side tracking platform based on the March 2026 blueprint:

- Frontend: Next.js 14 App Router
- Dashboard API: NestJS 10
- Event processor: Fastify + TypeScript
- Data layer: PostgreSQL 16, Redis 7, ClickHouse
- Local orchestration: Docker Compose

## Workspace

```text
SST/
  apps/
    frontend/
    api/
    event-processor/
  packages/
    shared/
  db/
  infra/
```

## Quick start

```bash
npm install
npm run docker:up
npm run db:prisma:generate
npm run dev
```

## Service URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Event processor: `http://localhost:3002`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- ClickHouse: `http://localhost:8123`

## Docker options

```bash
npm run docker:up
npm run docker:up:full
npm run docker:down
```

`docker:up` starts only the databases for local development. `docker:up:full` also builds and runs the frontend, API, event processor, and nginx gateway using the local source tree.
