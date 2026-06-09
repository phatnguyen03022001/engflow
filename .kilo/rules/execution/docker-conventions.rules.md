/* @lifecycle ACTIVE — Execution Rules: Docker Conventions */
/* @tags backend, infra */

# Docker Conventions

## 1. Purpose

Defines Docker and Docker Compose conventions for local development and deployment.

---

## 2. Container Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   engflow (app)     │◄────│  floweng-db (pg)    │
│   Node.js 20        │     │  PostgreSQL 16      │
│   Port 3001         │     │  Port 5432          │
└─────────────────────┘     └─────────────────────┘
```

## 3. Docker Compose (`backend/docker-compose.yml`)

### Services

| Service | Image | Container Name | Port |
|---------|-------|----------------|------|
| `postgres` | postgres:16-alpine | `floweng-db` | 5432 |
| `app` | Dockerfile (multi-stage) | `engflow` | 3001 |

### Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `POSTGRES_USER=floweng` | postgres | Database user |
| `POSTGRES_PASSWORD=floweng` | postgres | Database password |
| `POSTGRES_DB=floweng` | postgres | Database name |
| `DATABASE_URL` | app | Full PostgreSQL connection string |
| `JWT_SECRET` | app | JWT signing secret |
| `JWT_EXPIRES_IN=7d` | app | JWT token expiry |
| `PORT=3001` | app | Application listen port |

## 4. Health Checks

PostgreSQL service MUST have a health check:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U floweng -d floweng']
  interval: 5s
  timeout: 5s
  retries: 5
```

The app service depends on PostgreSQL health: `condition: service_healthy`.

## 5. Volume Management

```bash
# Named volume for persistence
volumes:
  pgdata:    # Stops container → data survives
             # docker compose down -v → data deleted

# View volume location
docker volume inspect engflow_pgdata
```

## 6. Common Commands

```bash
# Start all services
docker compose up -d

# Rebuild and start app
docker compose up -d --build app

# View logs
docker compose logs -f
docker compose logs -f app

# Stop all services
docker compose down

# Stop and delete volumes (⚠️ destroys data)
docker compose down -v
```

## 7. Production vs Development

- **Development:** Docker Compose with hot-reload via mounted volumes (future)
- **Production:** Multi-stage Dockerfile, minimized image, non-root user (`nestjs`)
- Never use development credentials (`floweng/floweng`) in production
- Never expose `DATABASE_URL` without encryption in production

---

**End of Docker Conventions**
