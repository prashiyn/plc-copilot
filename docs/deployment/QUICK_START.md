# PLCAutoPilot — Quick Start (Operators)

One-page bootstrap for local or first deploy. Full detail: [ADMIN_GUIDE.md](ADMIN_GUIDE.md).

---

## Prerequisites

Node.js 20+, Docker Compose, `ANTHROPIC_API_KEY`, `AUTH_SECRET` (`openssl rand -base64 33`).

---

## 1. Bootstrap (copy-paste)

```bash
npm install
cp .env.example .env          # set AUTH_SECRET, ANTHROPIC_API_KEY, AUTOMATION_API_KEY
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Web app |
| http://localhost:8000/docs | Automation API |

---

## 2. Sign in

| Account | Email | Password | When |
|---------|-------|----------|------|
| **Demo** | `demo@plcai.com` | `demo1234` | After `db:seed` (dev/demos) |
| **First admin** | *(your signup)* | *(your choice)* | `/signup` — first user = `superadmin` |

Seed also adds two sample projects: Motor Start/Stop Demo, PID Temperature Control.

---

## 3. Required `.env` (minimum)

```env
DATABASE_URL=postgresql://plc:plc@localhost:5432/plc_copilot
AUTH_SECRET=<openssl rand -base64 33>
ANTHROPIC_API_KEY=sk-ant-...
AUTOMATION_API_URL=http://localhost:8000
AUTOMATION_API_KEY=dev-automation-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`AUTOMATION_API_KEY` must match on Next.js and automation containers.

---

## 4. Production Docker (all-in-one)

```bash
docker compose --profile full up -d --build
```

Set `AUTH_SECRET`, `ANTHROPIC_API_KEY`, and a non-default `AUTOMATION_API_KEY` in `.env` first. Run `npm run db:migrate` and create admin via `/signup` (skip `db:seed` in production).

---

## 5. Verify

```bash
curl http://localhost:8000/health
npm run test:plc && npm run build
```

In browser: login → `/projects` → open a project → tabs load.

---

## 6. Reset DB (destructive)

```bash
docker compose down -v && docker compose up -d && npm run db:migrate && npm run db:seed
```

---

## 7. Help

| Issue | Fix |
|-------|-----|
| DB connection failed | `docker compose ps` — wait for `plc-copilot-db` healthy |
| AI / generation fails | Check `ANTHROPIC_API_KEY`, `docker logs plc-copilot-automation-worker` |
| Demo login fails | `npm run db:seed` |

**More:** [ADMIN_GUIDE.md](ADMIN_GUIDE.md) · [RUNBOOK.md](../RUNBOOK.md)
