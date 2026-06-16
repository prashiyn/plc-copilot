# PLCAutoPilot — System Administrator Guide

Concise setup and operations reference for deploying and running PLCAutoPilot (Next.js + Postgres + Redis + Python automation service).

**Audience:** sysadmins, DevOps, and platform operators.  
**Related:** [RUNBOOK.md](../RUNBOOK.md) (developer phase log), [ON_PREMISES_DEPLOYMENT.md](../architecture/ON_PREMISES_DEPLOYMENT.md) (enterprise/offline).

---

## 1. Architecture (what you are starting)

| Component | Default port | Purpose |
|-----------|-------------|---------|
| **Next.js app** | 3000 | Web UI + BFF API routes |
| **Postgres 16** | 5432 | Application database (Drizzle ORM) |
| **Redis 7** | 6379 | Job queue for automation worker |
| **automation-api** | 8000 | FastAPI — PLC generation & Claude AI |
| **automation-worker** | — | Background jobs (sketch, AI, generation) |

Local dev typically runs **Next.js on the host** (`npm run dev`) and **infra in Docker**. Production can use `docker compose --profile full` to run Next.js in a container too.

---

## 2. Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| Node.js | 20+ |
| npm | Comes with Node |
| Docker + Docker Compose | For Postgres, Redis, automation stack |
| `ANTHROPIC_API_KEY` | Required for AI features (Python worker) |
| OpenSSL | To generate `AUTH_SECRET` |

Optional for Python development outside Docker:

```bash
cd automation && uv sync
```

---

## 3. First-time setup (development)

From the repository root:

```bash
# 1. Install Node dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — see §4

# 3. Start infrastructure (Postgres, Redis, automation-api, worker)
docker compose up -d

# 4. Wait for healthy containers
docker compose ps

# 5. Apply database migrations
npm run db:migrate

# 6. Seed demo user + sample projects (recommended for first login)
npm run db:seed

# 7. Start the web app
npm run dev
```

Open **http://localhost:3000**. Automation API docs: **http://localhost:8000/docs**.

### Verify stack health

```bash
curl -s http://localhost:8000/health          # {"status":"ok"} or similar
curl -s http://localhost:8000/ready           # readiness (Redis, etc.)
docker inspect -f '{{.State.Health.Status}}' plc-copilot-db   # healthy
```

Sign in with the seeded demo account (§6) or create the first admin via signup (§5).

---

## 4. Environment variables

Copy `.env.example` → `.env`. **Never commit `.env`.**

### Required for a working deployment

| Variable | Example | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://plc:plc@localhost:5432/plc_copilot` | Must match Postgres credentials |
| `AUTH_SECRET` | *(random 32+ chars)* | `openssl rand -base64 33` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Used by automation-api/worker |
| `AUTOMATION_API_URL` | `http://localhost:8000` | Host dev: localhost; Docker full stack: `http://automation-api:8000` |
| `AUTOMATION_API_KEY` | `dev-automation-key` | **Must match** on Next.js and automation containers |

### Commonly set

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL of the Next.js app |
| `CLAUDE_MODEL` | `claude-3-5-sonnet-20241022` | Model for Python service |
| `AUTOMATION_REQUEST_TIMEOUT_MS` | `300000` | Long-running generation jobs |
| `MAX_UPLOAD_MB` | `10` | Automation API upload limit |
| `REDIS_URL` | `redis://localhost:6379/0` | Set automatically in Compose for containers |

Stripe, SMTP, and analytics keys are optional; billing UI exists but Stripe checkout is not required for core PLC features.

---

## 5. Database setup

### Connection

- **Engine:** PostgreSQL 16  
- **ORM / migrations:** Drizzle (`lib/db/schema.ts`, `lib/db/migrations/`)  
- **Default local URL:** `postgresql://plc:plc@localhost:5432/plc_copilot` (from `docker-compose.yml`)

### Commands

| Command | When to use |
|---------|-------------|
| `npm run db:migrate` | **Production & fresh installs** — apply pending SQL migrations |
| `npm run db:generate` | After editing `lib/db/schema.ts` (developers generate new migration files) |
| `npm run db:push` | Dev-only shortcut; pushes schema without migration files |
| `npm run db:studio` | Browse/edit data in Drizzle Studio |
| `npm run db:seed` | Insert demo user + sample projects (idempotent) |

### Fresh database (destructive reset)

```bash
docker compose down -v
docker compose up -d
npm run db:migrate
npm run db:seed
```

### Inspect database

```bash
docker exec plc-copilot-db psql -U plc -d plc_copilot -c '\dt'
docker exec plc-copilot-db psql -U plc -d plc_copilot -c "SELECT email, role FROM users;"
```

### Production database

Point `DATABASE_URL` at your managed Postgres instance. Run `npm run db:migrate` once per release that includes new migration files. Do **not** use `db:push` in production.

---

## 6. Users, roles, and accounts

### Role model

| Role | How it is assigned | Typical use |
|------|-------------------|-------------|
| `superadmin` | First user in the database, or demo seed | Full platform access |
| `admin` | Every subsequent `/signup` registration | Organization administrator |
| `user` | Schema supports it; not assigned by current signup flow | Reserved for future team features |

Data is scoped by **organization** (`organizationId` on users and projects). The session carries `id`, `role`, and `organizationId` (Auth.js JWT).

### Method A — Demo user (development / demos)

```bash
npm run db:seed
```

| Field | Value |
|-------|-------|
| Email | `demo@plcai.com` |
| Password | `demo1234` |
| Role | `superadmin` |
| Organization | Demo Organization (`demo-org`) |

Also creates two sample projects (v1.7):

- **Motor Start/Stop Demo** (`in_progress`)
- **PID Temperature Control** (`completed`)

The seed is **idempotent**: re-running it skips existing demo user and only adds missing sample projects.

Login: **http://localhost:3000/login** → “Continue as Demo User”, or sign in with the credentials above.

> **Production:** Do not rely on the default demo password. Either skip `db:seed`, change the password immediately after first login (Settings → Security), or remove the demo user (see §6.4).

### Method B — First admin via signup (recommended for production bootstrap)

1. Ensure migrations are applied and **no users exist** (or you accept that an existing user already holds `superadmin`).
2. Open **http://localhost:3000/signup**.
3. Register with email, password (≥ 8 characters), and organization name.

The **first user ever created** in an empty database becomes **`superadmin`**. Each signup creates a new organization; that user is its admin.

### Method C — Additional organization admins

Any further signup (while users already exist) creates a new organization with role **`admin`**.

There is no separate admin UI for inviting users in v1.7; use signup or direct database operations.

### Method D — Promote or create users via SQL (emergency / automation)

Passwords are stored as **bcrypt** hashes (`bcryptjs`, cost 10). Example: promote an existing user:

```sql
UPDATE users SET role = 'superadmin' WHERE email = 'you@company.com';
```

To insert a user manually you must generate a bcrypt hash (e.g. Node REPL: `require('bcryptjs').hashSync('YourPassword', 10)`), then insert into `users` with a valid `organization_id` from `organizations`.

### Change password (end user)

Signed-in users: **Settings → Security** (`/settings/security`) → `PATCH /api/settings/password`.

---

## 7. Starting the application

### Development (recommended)

```bash
docker compose up -d          # Postgres + Redis + automation only
npm run dev                   # Next.js on :3000
```

### Production-like (all services in Docker)

```bash
docker compose --profile full up -d --build
```

This builds and runs `nextjs` with `DATABASE_URL=postgresql://plc:plc@postgres:5432/plc_copilot` and `AUTOMATION_API_URL=http://automation-api:8000`. Ensure `AUTH_SECRET` and `ANTHROPIC_API_KEY` are set in `.env`.

### Stop services

```bash
docker compose down           # keep volumes
docker compose down -v        # remove DB volume (destructive)
```

### Build verification (release gate)

```bash
npm run test:plc
npm run build
cd automation && uv run pytest api/tests -q
```

---

## 8. Post-setup smoke test

After migrate + seed, as `demo@plcai.com`:

1. **Login** → `/dashboard` loads with project stats.
2. **Projects** → `/projects` shows two seed projects.
3. **Workspace** → open a project → all tabs load (Overview, Programs, Files, etc.).
4. **Generator** → `/generator` — generate with a project selected; program appears on project Programs tab.
5. **Automation API** → `curl http://localhost:8000/health` succeeds.

---

## 9. Operations cheat sheet

| Task | Command / action |
|------|------------------|
| View logs (automation API) | `docker logs -f plc-copilot-automation-api` |
| View logs (worker) | `docker logs -f plc-copilot-automation-worker` |
| View logs (Postgres) | `docker logs -f plc-copilot-db` |
| Redis ping | `docker exec plc-copilot-redis redis-cli ping` |
| Re-run seed safely | `npm run db:seed` |
| Typecheck (strict) | `npx tsc --noEmit -p tsconfig.json` |
| Lint | `npm run lint` |

### Backup (Postgres)

```bash
docker exec plc-copilot-db pg_dump -U plc plc_copilot > backup_$(date +%F).sql
```

### Restore

```bash
cat backup.sql | docker exec -i plc-copilot-db psql -U plc -d plc_copilot
```

User uploads (v1.7) are stored under `public/uploads/projects/` on the Next.js host (or `nextjs_uploads` Docker volume in full stack).

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `DATABASE_URL is not set` | Create `.env` from `.env.example` |
| Migration connection refused | `docker compose ps` — wait for `plc-copilot-db` healthy |
| Port 5432 in use | Stop other Postgres or change host port in `docker-compose.yml` |
| AI routes fail / timeout | Check `ANTHROPIC_API_KEY`, worker logs, `curl localhost:8000/ready` |
| 401 from automation routes | `AUTOMATION_API_KEY` must match in Next.js and automation containers |
| Login fails for demo user | Run `npm run db:seed`; confirm user exists in `users` table |
| `AUTH_SECRET` missing | Generate and set in `.env`; restart Next.js |
| Demo projects missing | `npm run db:seed` (adds samples if demo user exists) |

---

## 11. Production security checklist

- [ ] Set a strong unique `AUTH_SECRET`
- [ ] Use strong Postgres credentials; update `DATABASE_URL` and `docker-compose.yml` if not using defaults
- [ ] Set a non-default `AUTOMATION_API_KEY` shared only between Next.js and automation services
- [ ] Do **not** expose demo credentials — skip seed or change/remove demo user
- [ ] Restrict Postgres/Redis ports to internal network (do not publish 5432/6379 publicly)
- [ ] Provide `ANTHROPIC_API_KEY` via secrets manager, not plain text in images
- [ ] Run `npm run db:migrate` on deploy; back up database before migrations
- [ ] Terminate TLS at reverse proxy; set `NEXT_PUBLIC_APP_URL` to the public HTTPS URL

---

## 12. Quick reference

```bash
# Full dev bootstrap
npm install && cp .env.example .env
docker compose up -d && npm run db:migrate && npm run db:seed && npm run dev

# Demo login
#   demo@plcai.com / demo1234

# First production admin
#   /signup (first user → superadmin)

# Health
curl http://localhost:8000/health
curl http://localhost:3000/api/auth/session   # after browser login (session cookie)
```

**Version:** documents app **v1.7.0** (project workspace, file uploads, templates v2). Update this guide when deployment scripts or seed behavior changes.
