# Local developer entry points. Run `make help` for a list.
# Uses system Python (no project venv) so packages are shared across projects.
# Override interpreter: make PY="py -3.12" demo   or   make PY=python3.12 demo
#
# Ports come from backend/.env and frontend/.env when present (see each .env.example).
-include backend/.env
-include frontend/.env
API_PORT ?= 8800
WEB_PORT ?= 5180
export WEB_PORT
export VITE_API_TARGET := http://127.0.0.1:$(API_PORT)
.DEFAULT_GOAL := help

ifeq ($(OS),Windows_NT)
  PY ?= py -3.12
  NULL := NUL
  # Prefix for one-shot env vars in cmd.exe recipes
  ENV_PYTHONPATH := set PYTHONPATH=.&&
  ENV_LIVE_AI := set RUN_LIVE_AI=1&&
else
  SHELL := /bin/bash
  PY ?= python3
  NULL := /dev/null
  ENV_PYTHONPATH := PYTHONPATH=.
  ENV_LIVE_AI := RUN_LIVE_AI=1
endif

PIP     := $(PY) -m pip
RUFF    := $(PY) -m ruff
PYTEST  := $(PY) -m pytest
UVICORN := $(PY) -m uvicorn
ALEMBIC := $(PY) -m alembic

.PHONY: db-upgrade db-current db-revision calibrate demo demo-fresh test-live paper-kit build start e2e api-types validate-content sim-compare help setup setup-backend setup-frontend dev backend frontend test test-backend test-frontend lint format check clean

help: ## Show available targets
ifeq ($(OS),Windows_NT)
	@findstr /R "^[a-zA-Z0-9_-]*:.*## " Makefile
else
	@grep -E '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
endif

setup: setup-backend setup-frontend ## Install all dependencies
ifeq ($(OS),Windows_NT)
	@if not exist backend\.env copy /Y backend\.env.example backend\.env >$(NULL)
	@if not exist frontend\.env copy /Y frontend\.env.example frontend\.env >$(NULL)
	@if not exist data mkdir data
else
	@test -f backend/.env || cp backend/.env.example backend/.env
	@test -f frontend/.env || cp frontend/.env.example frontend/.env
	@mkdir -p data
endif

setup-backend: ## Install backend deps into system Python (shared, no venv)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r backend/requirements.lock

setup-frontend: ## Install frontend deps
	cd frontend && npm ci

dev: ## Run API (:8800) and web (:5180) together
ifeq ($(OS),Windows_NT)
	@echo Starting API and web in separate windows...
	start "exec-sim-api" cmd /c "cd /d backend && $(UVICORN) app.main:app --reload --reload-dir app --reload-dir sim --no-access-log --host 127.0.0.1 --port $(API_PORT)"
	start "exec-sim-web" cmd /c "cd /d frontend && npm run dev"
else
	@trap 'kill $$(jobs -p) 2>/dev/null' INT TERM EXIT; \
	  (cd backend && $(UVICORN) app.main:app --reload --reload-dir app --reload-dir sim --no-access-log --host 127.0.0.1 --port $(API_PORT)) & \
	  (cd frontend && npm run dev) & \
	  wait
endif

backend: ## Run API only
	cd backend && $(UVICORN) app.main:app --reload --reload-dir app --reload-dir sim --no-access-log --host 127.0.0.1 --port $(API_PORT)

frontend: ## Run web only
	cd frontend && npm run dev

test: test-backend test-frontend ## Run all tests

test-backend:
	cd backend && $(PYTEST)

demo: ## Create a fully played demo session (app must be running) and print links
	cd backend && $(PY) scripts/demo_session.py

demo-fresh: ## Create a clean, started session for a live walkthrough
	cd backend && $(PY) scripts/demo_session.py --fresh

test-live: ## Live Claude analyst checks (uses API credits; needs ANTHROPIC_API_KEY in backend/.env)
	cd backend && $(ENV_LIVE_AI) $(PYTEST) tests/test_live_analyst.py -v

test-frontend:
	cd frontend && npm test

lint: ## Lint + typecheck everything
	cd backend && $(RUFF) check . && $(RUFF) format --check .
	cd frontend && npm run -s lint && npm run -s typecheck && npm run -s format:check

format: ## Auto-format everything
	cd backend && $(RUFF) check --fix . && $(RUFF) format .
	cd frontend && npm run -s format

build: ## Production build of the web app (served by FastAPI from frontend/dist)
	cd frontend && npm run -s build

start: build ## Run the production-style server: API + built UI on :8800
	cd backend && $(UVICORN) app.main:app --host 127.0.0.1 --port $(API_PORT) --workers 1 --no-access-log

e2e: ## Browser end-to-end test (requires `make dev` running)
	cd frontend && npx playwright test

api-types: ## Regenerate frontend TypeScript types from the API's OpenAPI schema
	cd backend && $(ENV_PYTHONPATH) $(PY) scripts/dump_openapi.py > ../frontend/src/api/openapi.json
	cd frontend && npx openapi-typescript src/api/openapi.json -o src/api/schema.d.ts

db-upgrade: ## Apply database migrations (the app also does this on start)
	cd backend && $(ENV_PYTHONPATH) $(ALEMBIC) upgrade head

db-current: ## Show the database's migration revision
	cd backend && $(ENV_PYTHONPATH) $(ALEMBIC) current

db-revision: ## Create a migration from model changes: make db-revision m="add x to y"
ifeq ($(OS),Windows_NT)
	@if "$(m)"=="" (echo usage: make db-revision m="describe the change" & exit /b 1)
else
	@test -n "$(m)" || (echo 'usage: make db-revision m="describe the change"' && exit 1)
endif
	cd backend && $(ENV_PYTHONPATH) $(ALEMBIC) revision --autogenerate -m "$(m)"

validate-content: ## Validate all content files and cross-references
	cd backend && $(PY) -m sim validate

paper-kit: ## Generate the printable paper/fallback kit into docs/paper-kit
	cd backend && $(PY) -m sim paperkit

sim-compare: ## Balance matrix of reference portfolios across payers
	cd backend && $(PY) -m sim compare

calibrate: ## Engine vs Content Pack 5.2 reference outcomes → docs/calibration.md
	cd backend && $(PY) -m sim calibrate --out ../docs/calibration.md

check: lint validate-content test ## Lint, validate content and test (run before marking a task done)

clean: ## Remove build artefacts and caches
ifeq ($(OS),Windows_NT)
	@if exist frontend\dist rmdir /s /q frontend\dist
	@if exist backend\.pytest_cache rmdir /s /q backend\.pytest_cache
	@if exist backend\.ruff_cache rmdir /s /q backend\.ruff_cache
	@for /d /r backend %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d"
else
	rm -rf frontend/dist backend/.pytest_cache backend/.ruff_cache
	find backend -name __pycache__ -type d -prune -exec rm -rf {} +
endif
