<div align="center">

# evols

**Your team's AI brain, taking shape.**

The calm, AI-native ProductOS. Knowledge, context, and coordination — in one place.

[Website](https://evols.ai) · [Docs](https://docs.evols.ai) · [Book a demo](https://evols.ai/book-demo)

</div>

---

## Part I — For users

### What is Evols?

Most teams don't have an AI problem. They have a *coordination* problem on top of AI.

PMs research the same competitor three times. Engineers solve the same infra issue twice. Decisions live in chat threads no one re-reads. When AI is bolted on top, it makes individual people faster — but the team's collective intelligence still resets to zero on Monday morning.

Evols turns every AI session your team runs into **shared, compounding intelligence**. One plugin install activates everything: zero cold start for new teammates, automatic redundancy detection before tokens are burned, and full visibility into your team's collective AI capacity.

### The four things Evols actually does

**1 · Auto-compiled team knowledge graph.** Every AI session contributes to a shared graph automatically. The next teammate's session inherits it — at roughly **8× fewer tokens** than rebuilding context from scratch. Sources can be meeting transcripts, design docs, customer interviews, Slack threads, GitHub PRs, support tickets, or anything else you'd otherwise paste into a prompt.

**2 · Three-tier product hierarchy.** Customer feedback flows up into a clean structure that's traceable end-to-end:

> **Theme** *(what customers are saying)* → **Initiative** *(how we respond)* → **Project** *(what we ship)*

Themes auto-cluster from feedback. Initiatives synthesize 2–4 themes. Projects are concrete work items, prioritized with **RICE** and split into 🏔️ *Boulders* (large) vs ⚡ *Pebbles* (quick wins). Every project traces back to the customer feedback that justified it.

**3 · Persona digital twins.** Auto-generate personas from your customer feedback. Ask each twin trade-off questions ("If you had to choose between A and B…") and get aggregate, confidence-scored answers grounded in real evidence. Twins refresh as new feedback comes in.

**4 · Works where you already work.** One install, zero glue:

- **Claude Code plugin** — `/plugin install evols@evols-ai`. Hooks fire at session start (load team context), prompt submit (redundancy check), and session end (auto-sync learnings via Haiku). MCP tools expose the team graph to your sessions.
- **Zed plugin** — auto-injects PM skills + team knowledge into every Zed AI thread via the Rules Library.
- **AI Workbench** — multi-model chat (Claude, GPT, Gemini, Bedrock, Ollama) with full Evols context, single sign-on, and BYOK proxy so your tenant's keys are used everywhere.

### What you get on day one

| | |
|---|---|
| **Zero cold start** | New teammates inherit the team graph from their first session — no setup, no accumulation period. |
| **Redundancy prevention** | Detect duplicate AI work *before* tokens are burned, not after the work collides at code review. |
| **Quota visibility** | See collective AI capacity across your team in real time. Redirect expiring quota to backlog tasks before it resets unused. |
| **Calm density** | A dark-first, AI-native interface that shows a lot without feeling busy. Every motion answers "what changed?" |
| **Governance** | Project- and role-level context permissions. Built for orgs that handle sensitive material. |
| **BYOK** | Bring your own keys — Anthropic, OpenAI, Azure, Bedrock. AES-encrypted per tenant. No keys at deploy time. |

### Pricing (early access)

- **Free** — bring your own LLM credentials, up to 5 users per tenant, all core features. No usage limits beyond your provider's costs.
- **Team** *(coming soon)* — 5+ users with BYOK.
- **Business** *(coming soon)* — use our optimized model setup, no configuration.
- **Enterprise** *(coming soon)* — RBAC, SSO, dedicated support.

[Get early access →](https://evols.ai/register) · [Book a demo →](https://evols.ai/book-demo)

---

## Part II — For developers and contributors

### What's in this repo

```
evols/
├── backend/              # FastAPI · Python 3.13 · Postgres + pgvector · Redis · Celery
│   ├── app/
│   │   ├── api/         # versioned routes under /api/v1
│   │   ├── core/        # config, auth, db, encryption
│   │   ├── models/      # SQLAlchemy models
│   │   ├── schemas/     # Pydantic schemas
│   │   ├── services/    # AI, clustering, persona, knowledge graph
│   │   └── workers/     # Celery background tasks
│   └── alembic/         # migrations
├── frontend/             # Next.js 14 (Pages Router) · TypeScript · Tailwind · shadcn/ui · Framer Motion
│   └── src/
│       ├── pages/       # routes
│       ├── components/  # shell + ui primitives + AI primitives
│       ├── styles/      # tokens.css + globals.css
│       └── contexts/    # ThemeContext, etc.
├── docker/              # Dockerfiles + docker-compose configs
├── docs/                # design system, architecture, setup guides
└── librechat.yaml       # AI Workbench (LibreChat fork) config

evols-claude-plugin/      # Sibling repo — Claude Code marketplace plugin
evols-zed-plugin/         # Sibling repo — Zed extension
evols-workbench/          # Sibling repo — LibreChat fork branded as Evols AI Workbench
```

### Architecture at a glance

```
Developer tools (Claude Code, Zed)
         │ MCP tools / hooks
         ▼
Evols Backend API  (FastAPI · localhost:8000)
  ├── /api/v1/team-knowledge   knowledge graph CRUD + semantic search
  ├── /api/v1/mcp              MCP Streamable-HTTP endpoint for tools
  ├── /api/v1/oidc             OIDC provider bridge for AI Workbench SSO
  ├── /api/v1/llm-proxy        BYOK proxy for AI Workbench
  └── /api/v1/{skills,context,personas,themes,projects,...}
         │
         ├── PostgreSQL + pgvector   structured data + 1024-dim embeddings
         ├── LightRAG                graph-based RAG, entity + relationship extraction
         └── Redis + Celery          caching + durable background jobs

AI Workbench (LibreChat fork)
  └── Nginx reverse proxy → /workbench/*

Frontend (Next.js · localhost:3000)
  └── consumes the backend, embeds the AI Workbench iframe
```

### Memory layers

Evols runs a four-tier memory stack — different layers for different durability and access patterns:

| Layer | Tech | Role |
|---|---|---|
| **Cache / hot session** | Redis | LLM-response cache, Celery broker, short-lived session state |
| **Semantic memory** | PostgreSQL + pgvector | All structured data plus 1024-dim embeddings for similarity + dedup |
| **Graph / institutional memory** | LightRAG (self-hosted) | The team brain — entity + relationship extraction across all ingested feedback / docs / meetings |
| **Working / chat memory** | MongoDB Atlas | Used by the AI Workbench (LibreChat fork) for active chat threads — talks to Evols via OIDC + LLM proxy |

When marketing copy says "team's AI brain," **LightRAG + pgvector working together** is what backs it. Redis is the caching glue. MongoDB only matters when the chat surface is up.

### Tech stack

**Backend** — FastAPI · Python 3.13 · PostgreSQL with pgvector · LightRAG · Celery · Redis · sentence-transformers · scikit-learn · HDBSCAN · Tavily/Serper · Anthropic / OpenAI / Azure / Bedrock SDKs · JWT, OAuth2, OIDC

**Frontend** — Next.js 14 (Pages Router) · React 18 · TypeScript · Tailwind CSS · shadcn/ui · Radix UI · Framer Motion · Recharts · D3 · React Query · Zustand · Geist Sans + Geist Mono + Instrument Serif

**AI Workbench** — LibreChat (MIT-licensed fork) · MongoDB Atlas · deployed as a Cloud Run sidecar behind nginx

**DevOps** — Docker · Docker Compose · Google Cloud Run · GitHub Actions

### Local development

#### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine + Compose plugin (Linux)
- Node.js 18+
- Python 3.13+ *(only if you want to run the backend outside Docker)*
- Git

#### Quick start (5 minutes — design review path)

This brings up Postgres + Redis + the FastAPI backend in containers, and runs the Next.js frontend on the host. **LightRAG and the AI Workbench are skipped** — they're optional and require additional setup.

```bash
git clone <repo-url> evols
cd evols

# Backend env — copy and let the script generate secrets, OR fill in by hand
cp backend/.env.example backend/.env
# Edit backend/.env: SECRET_KEY, FIELD_ENCRYPTION_KEY, ENCRYPTION_MASTER_SECRET,
# SUPER_ADMIN_CREATION_TOKEN. Generate each with:
#   python -c 'import secrets; print(secrets.token_urlsafe(32))'
# FIELD_ENCRYPTION_KEY needs a Fernet key:
#   python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'

# Frontend env — point at the backend
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > frontend/.env.local

# Bring up the dev stack (postgres + redis + backend)
docker compose -f docker/docker-compose.dev.yml up -d --build

# Stamp alembic to current head (tables are created by the backend's startup hook)
docker compose -f docker/docker-compose.dev.yml exec backend alembic stamp head

# Start the frontend
cd frontend
npm install
npm run dev
```

Then:

1. Open **<http://localhost:3000/admin-setup>** and create the first SUPER_ADMIN using the `SUPER_ADMIN_CREATION_TOKEN` from `backend/.env`.
2. Sign in → land on `/admin/tenants` → create a tenant.
3. Create a regular user inside that tenant. Sign in as that user → land on `/workbench` and explore the product.

**Notes on the dev path:**

- `docker-compose.dev.yml` excludes LightRAG (knowledge-graph features will surface "no data" empty states — the rest of the product is fully usable).
- The Workbench page renders a "still warming up" empty state when the LibreChat fork isn't deployed; everything else works.
- `USE_CELERY=False` runs background jobs synchronously — fine for development.

#### Full stack

For the full feature set including LightRAG and the AI Workbench:

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

This pulls/builds **5 services** (postgres, redis, backend, lightrag, frontend). First-time build is ~10–15 min because LightRAG is heavy.

For LibreChat, follow the AI Workbench fork's setup in `evols-workbench/CLAUDE.md`.

### Frontend design system

The design language lives in two layers:

- **Tokens** — `frontend/src/styles/globals.css` defines the dark-first iris→mint duotone, aurora atmosphere, glass surfaces, and the `.thinking-surface` / `.stream-shimmer` / `.halo-ring` AI primitives.
- **Components** — `frontend/src/components/ui/` has the AI primitives (`AIShimmer`, `AIThinking`, `ToolUseChip`, `CitationPill`, `ConfidenceBar`, `ThinkingSurface`, `Halo`) and the global `AskEvolsDock`. Page chrome lives in `frontend/src/components/` (`Header`, `Footer`, `Logo`, `PageContainer`).

The full design philosophy, motion language, and component spec is in **[`docs/design/EVOLS_DESIGN_HANDOFF.md`](docs/design/EVOLS_DESIGN_HANDOFF.md)**. The smoke-test checklist for any design change is in **[`docs/design/SMOKE_TESTS.md`](docs/design/SMOKE_TESTS.md)**.

Three rules to design by:

> 1. AI is chrome, not a feature.
> 2. Calm density. Show a lot, but layer it with hierarchy and air.
> 3. Motion = meaning. Every animation answers "what changed?"

### Backend conventions

- Routes are versioned under `/api/v1/<resource>` and follow REST + JSON.
- All long-running work goes through Celery tasks (`backend/app/workers/`). Endpoints return job IDs; the frontend polls via `useJobPolling`.
- LLM calls are routed through the LLM proxy (`/api/v1/llm-proxy`) which uses tenant-scoped BYOK keys. **Do not** read LLM keys from environment variables in application code.
- All tenant API keys are encrypted with the tenant's `FIELD_ENCRYPTION_KEY` (Fernet). Never log decrypted keys.
- Migrations live in `backend/alembic/versions/`. Generate with `alembic revision --autogenerate -m "<message>"` and review the diff carefully — `Base.metadata.create_all()` runs at startup so the schema can drift without you noticing.

### Testing

```bash
# Frontend
cd frontend
npm run type-check   # tsc --noEmit
npm run lint         # next lint
npm run build        # prod build smoke test

# Backend (from inside the container or with the venv active)
cd backend
pytest               # full suite
pytest tests/api     # just API tests
```

### Deploying

Production runs on Google Cloud Run with an nginx reverse proxy as the single public entry point. See `deployment/` for the Terraform / IaC and runbooks.

### Contributing

Issues and PRs welcome. A few ground rules:

- One coherent change per PR. If your description has two "and"s in it, it's two PRs.
- New components go through `docs/design/SMOKE_TESTS.md` before merge.
- New design tokens land in `globals.css` first, then get an entry in `EVOLS_DESIGN_HANDOFF.md`.
- Backend changes that touch the schema land with an alembic migration in the same PR.
- Run `npm run type-check` and `pytest` locally before pushing.

### License

Copyright © 2026 Evols. All rights reserved.

### Where to go next

| | |
|---|---|
| Setup walkthrough | [`SETUP_GUIDE.md`](SETUP_GUIDE.md) |
| Three-tier architecture deep dive | [`docs/THREE_TIER_ARCHITECTURE.md`](docs/THREE_TIER_ARCHITECTURE.md) |
| Async API contract | [`docs/ASYNC_API.md`](docs/ASYNC_API.md) |
| Data retention & encryption | [`DATA_RETENTION_IMPLEMENTATION.md`](DATA_RETENTION_IMPLEMENTATION.md) |
| Deduplication system | [`DEDUPLICATION_IMPLEMENTATION.md`](DEDUPLICATION_IMPLEMENTATION.md) |
| Design system | [`docs/design/EVOLS_DESIGN_HANDOFF.md`](docs/design/EVOLS_DESIGN_HANDOFF.md) |
| Changelog | [`CHANGELOG.md`](CHANGELOG.md) |

---

<div align="center">
<sub>Build calmly. Ship the brain.</sub>
</div>
