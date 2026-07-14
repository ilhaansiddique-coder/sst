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
npm run services:up
npm run db:prisma:generate
npm run dev
```

The repo now includes a local `docker-compose.yml` that starts PostgreSQL, Redis, and ClickHouse with the same defaults used in `.env`.

## Local defaults

- PostgreSQL: database `tracking`, user `tracking`, password `tracking_dev_password`, port `5432`
- Redis: password `tracking_redis_password`, port `6379`
- ClickHouse: database `tracking`, default user with no password, port `8123`

If you prefer bringing the dependencies up yourself, configure PostgreSQL, Redis, and ClickHouse separately and keep the connection values in `.env` aligned with those services.

To inspect or reset the local stack:

```bash
npm run services:logs
npm run services:down
npm run services:reset
```

The SQL bootstrap files remain in `db/` and are mounted automatically into the Docker services on first startup.

## Service URLs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001/api`
- Event processor: `http://localhost:3002`

## Database bootstrap

- PostgreSQL init: `db/postgres-init.sql`
- ClickHouse init: `db/clickhouse-init.sql`

## Render deployment

`render.yaml` defines the frontend, API, and event processor as native Render web services, along with managed Redis and Postgres resources.
# Server-Side-Tracking
