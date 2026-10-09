# Medicare Advantage AI Executive Simulation

A facilitated, decision-driven executive workshop built from the **Requirements v0.1** and the **Content Pack v0.1**. Leadership teams run one of three fictional Medicare Advantage plans. They investigate a 30-file data room with an AI analyst, fund 18 conditional investment cards over two rounds (with a scored board pitch in between), live with delayed and simulated Stars, design a human/AI operating model, handle a crisis their own choices trigger, and translate the lessons into an AI Opportunity Map.

- **Docs index:** [`docs/`](docs/README.md)
- **Scope:** [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)
- **Demo script:** [`docs/DEMO_FLOW.md`](docs/DEMO_FLOW.md)
- **Task tracker:** Part 7 of `docs/REQUIREMENTS.md`
- **Content Pack cross-check:** Part 3 of `docs/REQUIREMENTS.md`; engine vs pack outcomes in [`docs/calibration.md`](docs/calibration.md)
- **Facilitator guide:** [`docs/facilitator-guide.md`](docs/facilitator-guide.md)
- **Simulation methodology and simplification register:** [`docs/model.md`](docs/model.md)

## Quick start (local)

Requires Python ≥ 3.12, Node ≥ 20 and make.

```bash
make setup      # venv + npm ci + backend/.env and frontend/.env
make dev        # API :8800 (docs at /docs) + web http://localhost:5180
# or
make start      # production-style: built UI + API on http://127.0.0.1:8800
```

1. Open the start page → **Facilitate** → create a session. Share each team's join code.
2. Each team opens the start page → **Join your team** → enter its code.
3. Run the session from the facilitator console. See the facilitator guide.

Each service has its own configuration file (templates: `backend/.env.example`, `frontend/.env.example`). The frontend file holds only the dev port, the proxy target and `VITE_API_URL`. Everything below lives in `backend/.env`:
- **Infrastructure:** ports, local SQLite path, token-signing secret.
- **AI:** key, model, effort, limits.
- **Game rules:** `SIM_MODE`, `ROUND2_MECHANIC`, `ROUND2_BASE_MUSD`, `CONFIDENCE_BAND`, `SIM_DEFAULT_SEED`, `INCLUDE_TRANSLATION`, `PITCH_AI_SUGGEST`, `OPPORTUNITY_RETENTION_DAYS`.

Blank game values fall back to `content/game.yaml`. Set `ADMIN_PASSWORD` to enable the **Settings** screen (`/settings`, linked from the start page). There you can change about 70 settings without editing files: session defaults, facilitation, the AI analyst, model parameters (§5), scorecard weights and pilot targets. Each one shows its source and env var. Precedence is `content/game.yaml` → `backend/.env` → saved in Settings. Runtime settings apply immediately; game settings apply to new sessions, because each session keeps a snapshot (adjust one session from its console's **Session settings** tab, with an audit note). Secrets stay in `backend/.env` only. The same screen holds the Content Pack §12 review sign-off and a list of sessions.

The AI analyst uses Claude when `ANTHROPIC_API_KEY` is set; otherwise it runs in retrieval-only mode.

## Deploying (Render, two services)

The API and the UI can run as two services. Set `VITE_API_URL` on the UI build so it calls the API, and set `CORS_ORIGINS` on the API so it accepts the UI.

| | API (Web Service) | UI (Static Site) |
|---|---|---|
| Root directory | `backend` | `frontend` |
| Build | `pip install -r requirements.lock` | `npm ci && npm run build` |
| Start / publish | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` | publish `dist` |
| Health check | `/api/health` | — |
| Env | `ENVIRONMENT=production`, `SECRET_KEY`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`, `CORS_ORIGINS=<UI URL>`, `PYTHON_VERSION` | `VITE_API_URL=<API URL>`, `NODE_VERSION` |
| Extra | A persistent disk at `/var/data` with `DATA_DIR=/var/data` and `DATABASE_URL=sqlite:////var/data/exec_sim.db`; without it, sessions are lost on every deploy or restart | Rewrite rule `/*` → `/index.html` so deep links work |

Use one API worker: live updates (WebSocket) and the session lock are in-process.

The API's production values are kept in `backend/.env.production` (git-ignored). Paste them into Render under **Environment → Add from .env**. The UI needs only `VITE_API_URL` and `NODE_VERSION`.

## Commands

| Command | What it does |
|---|---|
| `make check` | Lint, strict typecheck, content validation, backend + frontend tests |
| `make test-live` | Live Claude analyst checks (uses API credits) |
| `make e2e` | Browser end-to-end session test (needs `make dev` running) |
| `make validate-content` | Validate all YAML content and cross-references |
| `make sim-compare` | Regression-suite matrix: reference portfolios × payers |
| `make calibrate` | Engine vs Content Pack §5.2 → `docs/calibration.md` |
| `make paper-kit` | Regenerate the printable kit (`docs/paper-kit/`) and answer keys (`docs/answer-keys/`) |
| `make api-types` | Regenerate frontend types from the OpenAPI schema |
| `make db-upgrade` / `make db-current` | Apply / show database migrations (also applied automatically on start) |
| `make db-revision m="…"` | Generate an Alembic migration after changing a table in `backend/app/db.py` |
| `cd backend && .venv/bin/python -m sim run --portfolio lg-sequenced` | Run a reference portfolio in the terminal and print both performance reviews |

## Architecture

```
frontend/  React 19 · TypeScript · Vite · React Router · TanStack Query · Recharts
           team workspace (/team) · facilitator console (/facilitator/:id)
backend/   app/   FastAPI · Pydantic v2 · SQLModel/SQLite · WebSocket hints · HMAC role tokens
           sim/   pure, seeded simulation engine + content loader (framework-free)
content/   YAML (Content Pack v0.1): game, measures, kpis, investments, events, stages, workflow,
           rubrics, reference, payers/ + 90 data-room artifacts
docs/      REQUIREMENTS.md · DEMO_FLOW.md · facilitator-guide.md · model.md · calibration.md ·
           paper-kit/ · answer-keys/ · source/ (the two v0.1 docx + plain-text Content Pack)
data/      local SQLite + generated signing secret (git-ignored)
backend/migrations/  Alembic migrations (schema history; a test fails if models drift)
```

**Security model:**
- Facilitator and team tokens are HMAC-signed and scoped to one session or one team.
- Hidden mechanics (root causes, card rules, crisis triggers, answer keys) are never sent to team tokens; tokens never appear in URLs or logs.
- Every facilitator override requires an audit note and is logged.

All organizations, members and data are fictional. Stars values are simulated and illustrative. No real PHI.
