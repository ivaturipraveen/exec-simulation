# Local developer entry points. Run `make help` for a list.
SHELL := /bin/bash
# Ports and other settings come from .env when present (see .env.example).
-include .env
API_PORT ?= 8800
WEB_PORT ?= 5180
export WEB_PORT
export VITE_API_TARGET := http://127.0.0.1:$(API_PORT)
.DEFAULT_GOAL := help

PY      := backend/.venv/bin/python
PIP     := backend/.venv/bin/pip
RUFF    := backend/.venv/bin/ruff
PYTEST  := backend/.venv/bin/pytest
UVICORN := backend/.venv/bin/uvicorn


.PHONY: db-upgrade db-current db-revision calibrate demo demo-fresh test-live paper-kit build start e2e api-types validate-content sim-compare help setup setup-backend setup-frontend dev backend frontend test test-backend test-frontend lint format check clean

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

setup: setup-backend setup-frontend ## Install all dependencies
	@test -f .env || cp .env.example .env
	@mkdir -p data

setup-backend: ## Create Python venv and install backend deps
	test -d backend/.venv || python3 -m venv backend/.venv
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r backend/requirements.lock

setup-frontend: ## Install frontend deps
	cd frontend && npm ci

dev: ## Run API (:8800) and web (:5180) together
	@trap 'kill $$(jobs -p) 2>/dev/null' INT TERM EXIT; \
	  (cd backend && .venv/bin/uvicorn app.main:app --reload --reload-dir app --reload-dir sim --no-access-log --host 127.0.0.1 --port $(API_PORT)) & \
	  (cd frontend && npm run dev) & \
	  wait

backend: ## Run API only
	cd backend && .venv/bin/uvicorn app.main:app --reload --reload-dir app --reload-dir sim --no-access-log --host 127.0.0.1 --port $(API_PORT)

frontend: ## Run web only
	cd frontend && npm run dev

test: test-backend test-frontend ## Run all tests

test-backend:
	cd backend && .venv/bin/pytest

demo: ## Create a fully played demo session (app must be running) and print links
	cd backend && .venv/bin/python scripts/demo_session.py

demo-fresh: ## Create a clean, started session for a live walkthrough
	cd backend && .venv/bin/python scripts/demo_session.py --fresh

test-live: ## Live Claude analyst checks (uses API credits; needs ANTHROPIC_API_KEY in .env)
	cd backend && RUN_LIVE_AI=1 .venv/bin/pytest tests/test_live_analyst.py -v

test-frontend:
	cd frontend && npm test

lint: ## Lint + typecheck everything
	cd backend && .venv/bin/ruff check . && .venv/bin/ruff format --check .
	cd frontend && npm run -s lint && npm run -s typecheck && npm run -s format:check

format: ## Auto-format everything
	cd backend && .venv/bin/ruff check --fix . && .venv/bin/ruff format .
	cd frontend && npm run -s format

build: ## Production build of the web app (served by FastAPI from frontend/dist)
	cd frontend && npm run -s build

start: build ## Run the production-style server: API + built UI on :8800
	cd backend && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $(API_PORT) --workers 1 --no-access-log

e2e: ## Browser end-to-end test (requires `make dev` running)
	cd frontend && npx playwright test

api-types: ## Regenerate frontend TypeScript types from the API's OpenAPI schema
	cd backend && PYTHONPATH=. .venv/bin/python scripts/dump_openapi.py > ../frontend/src/api/openapi.json
	cd frontend && npx openapi-typescript src/api/openapi.json -o src/api/schema.d.ts

db-upgrade: ## Apply database migrations (the app also does this on start)
	cd backend && PYTHONPATH=. .venv/bin/alembic upgrade head

db-current: ## Show the database's migration revision
	cd backend && PYTHONPATH=. .venv/bin/alembic current

db-revision: ## Create a migration from model changes: make db-revision m="add x to y"
	@test -n "$(m)" || (echo 'usage: make db-revision m="describe the change"' && exit 1)
	cd backend && PYTHONPATH=. .venv/bin/alembic revision --autogenerate -m "$(m)"

validate-content: ## Validate all content files and cross-references
	cd backend && .venv/bin/python -m sim validate

paper-kit: ## Generate the printable paper/fallback kit into docs/paper-kit
	cd backend && .venv/bin/python -m sim paperkit

sim-compare: ## Balance matrix of reference portfolios across payers
	cd backend && .venv/bin/python -m sim compare

calibrate: ## Engine vs Content Pack 5.2 reference outcomes → docs/calibration.md
	cd backend && .venv/bin/python -m sim calibrate --out ../docs/calibration.md

check: lint validate-content test ## Lint, validate content and test (run before marking a task done)

clean: ## Remove build artefacts and caches
	rm -rf frontend/dist backend/.pytest_cache backend/.ruff_cache
	find backend -name __pycache__ -type d -prune -exec rm -rf {} +
