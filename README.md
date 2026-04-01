# SST

SST is a monorepo starter for a server-side tracking platform based on the March 2026 blueprint:

- Frontend: Next.js 14 App Router
- Dashboard API: NestJS 10
- Event processor: Fastify + TypeScript
- Data layer: PostgreSQL 16, Redis 7, ClickHouse
- Deployment: Render blueprint with native Node services

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
npm run db:prisma:generate
npm run dev
```

Provide PostgreSQL, Redis, and ClickHouse separately and configure the connection values in `.env` before starting the apps. The SQL bootstrap files remain in `db/` for manual database setup.

## Service URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Event processor: `http://localhost:3002`

## Database bootstrap

- PostgreSQL init: `db/postgres-init.sql`
- ClickHouse init: `db/clickhouse-init.sql`

## Render deployment

`render.yaml` defines the frontend, API, and event processor as native Render web services, along with managed Redis and Postgres resources.
