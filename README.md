# Evols

**Evolve your product roadmap**

Turn customer feedback into prioritized roadmaps automatically. Help senior PMs at scaling B2B SaaS companies turn all their customer and product data into fast, explainable product decisions they can confidently defend and execute.

## Overview

Evols is an AI-native Product Decision OS that helps product managers:
- **Get AI assistance for PM tasks** via interactive Skills (PRD writing, user research, competitive analysis, sprint planning, etc.)
- **Consolidate fragmented evidence** from 20+ data sources (meetings, docs, tickets, surveys, repos)
- **Extract intelligence automatically** with entity recognition and semantic search
- **Auto-cluster feedback** into themes with revenue impact and urgency
- **Generate prioritized roadmaps** with RICE scoring and data-driven recommendations
- **Simulate persona digital twins** for product validation and trade-off decisions
- **Track work context** (projects, tasks, decisions, relationships) to build institutional product memory
- **Maintain privacy and compliance** with data retention policies, encryption, and audit logs
- **Share team knowledge** across Claude Code, Zed, and the AI Workbench via a unified knowledge graph
- **AI Workbench** — LibreChat-based multi-model chat UI with full Evols context, no extra login required

## Features

### Core Features
1. **AI Skills System** 🤖 *Interactive PM Assistants*
   - Pre-built AI skills for common PM tasks
   - Custom skill creation and versioning
   - User-level skill customization (custom instructions, context, output format)
   - A/B testing with adaptive bandit optimization
   - Session-based conversations with context retention
   - Multi-turn refinement and iterative improvement
   - Built-in tools: web research (Tavily/Serper), data analysis, document generation
   - Sentiment analysis and user feedback tracking

2. **Context Management System** 📚 *Unified Data Intelligence*
   - Upload any data source: meetings, docs, surveys, support tickets
   - Supports 20+ source types (CSV, PDF, Slack, GitHub, MCP servers, etc.)
   - Automatic entity extraction (personas, pain points, use cases, feature requests)
   - Semantic embedding and vector search with pgvector
   - **LightRAG knowledge graph** for deep relationship extraction across all ingested data
   - Link entities to initiatives with relevance scoring
   - Evidence aggregation with deduplication
   - **Data Retention & Privacy**:
     - User-controlled retention policies (delete immediately, 30/90 days, encrypted storage)
     - AES-256-GCM encryption with PBKDF2 key derivation
     - Content access audit logs for compliance (SOC2, GDPR)
     - Automatic content deletion with preserved evidence summaries
   - **Deduplication System**:
     - SHA-256 content hash detection at upload
     - Semantic similarity matching with pgvector
     - Source grouping for related documents (same meeting/event)
     - Prevents inflated metrics when multiple PMs upload same content

3. **AI-Assisted Synthesis** ⚡ *Async Processing*
   - Auto-cluster feedback into themes using embeddings + LLM
   - Link themes to accounts and ARR
   - Calculate urgency and severity scores
   - Generate strategic initiatives from themes
   - **Background processing** for large datasets (no timeouts)
   - **Real-time progress tracking** with status updates
   - **Auto-generate prioritized projects** (boulders & pebbles) with RICE scoring

4. **Team Knowledge Graph** 🧠 *Shared Institutional Memory*
   - Automatically captures learnings from Claude Code and Zed sessions
   - Semantic search to surface relevant prior work before starting a new task
   - Redundancy detection: flags when a teammate already solved something similar
   - Token savings estimates (shows how much context retrieval saves vs. compiling fresh)
   - Per-session knowledge entries with role, session type, tags, and product area
   - Used by the Evols Claude Code plugin, Zed plugin, and AI Workbench MCP tools

5. **Persona Digital Twins**
   - Auto-generate personas from customer segments
   - LLM-powered response simulation
   - "Ask Persona" chat interface
   - Trade-off voting with confidence scores

6. **Multi-Tenancy & Auth**
   - Three role types: SUPER_ADMIN, TENANT_ADMIN, USER
   - Session management and multi-device support
   - **Long-lived API keys** (`evols_...` format) for plugin and service authentication
   - User preferences and settings
   - Complete data isolation per tenant

### Developer Tools

7. **Evols Claude Code Plugin** 🔌 *Zero-friction team context in Claude Code*
   - Installs from the Evols marketplace: `/plugin install evols@evols-ai`
   - **SessionStart**: loads relevant team knowledge entries automatically at session start
   - **UserPromptSubmit**: redundancy check before Claude processes your first prompt
   - **PostToolUse**: captures notable Bash/WebFetch outputs mid-session
   - **Stop**: auto-syncs a knowledge entry via Haiku summarization, prints token/quota summary
   - MCP tools: `get_team_context`, `sync_session_context`, `get_quota_status`
   - Works in both CLI and VSCode extension

8. **Evols Zed Plugin** 🧩 *Team context in Zed AI*
   - Injects PM skills + team knowledge into every new Zed AI thread via the Rules Library
   - MCP tools: `get_pm_skill`, `get_team_context`, `sync_session_context`, `check_redundancy`, `get_quota_status`
   - Slash commands: `/evols:reload`, `/evols:skill <name>`

9. **AI Workbench** 💬 *Multi-model chat with full Evols context*
   - LibreChat fork branded as "Evols AI Workbench"
   - Supports Claude, GPT, Gemini, Ollama, and any OpenAI-compatible endpoint
   - Single sign-on via OIDC bridge — users log in through Evols, no separate account
   - LLM calls proxy through Evols backend using tenant BYOK keys (no keys at deploy time)
   - MCP tools give the AI access to team knowledge, personas, themes, and product data
   - Deployed as an internal Cloud Run service behind Nginx reverse proxy

## Architecture

```
Evols/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── core/     # Business logic, auth, config
│   │   ├── models/   # Database models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # AI, clustering, persona, knowledge services
│   │   └── workers/  # Celery background task workers
│   ├── tests/
│   └── requirements.txt
├── frontend/         # React/Next.js frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── styles/
│   │   └── utils/
│   └── package.json
├── librechat.yaml    # AI Workbench server config (LLM endpoints, MCP, auth)
└── docker/          # Docker configurations
    ├── backend.Dockerfile
    ├── frontend.Dockerfile
    └── docker-compose.yml

evols-claude-plugin/  # Claude Code plugin (separate repo)
evols-zed-plugin/     # Zed extension (separate repo)
evols-workbench/      # LibreChat fork as AI Workbench (separate repo)
```

### System Overview

```
Developer tools (Claude Code, Zed)
         │ MCP tools / hooks
         ▼
Evols Backend API (FastAPI)
  ├── /api/v1/team-knowledge   — knowledge graph CRUD + semantic search
  ├── /api/v1/mcp              — MCP Streamable-HTTP endpoint for tools
  ├── /api/v1/oidc             — OIDC provider bridge for AI Workbench SSO
  ├── /api/v1/llm-proxy        — BYOK LLM proxy for AI Workbench
  └── ... (skills, context, personas, themes, projects)
         │
         ├── PostgreSQL + pgvector   — primary store
         ├── LightRAG                — knowledge graph (relationship extraction)
         └── Redis + Celery          — background jobs

AI Workbench (LibreChat fork)
  └── Nginx reverse proxy → /workbench/*
```

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.13+)
- **Database**: PostgreSQL with pgvector
- **Knowledge Graph**: LightRAG (self-hosted, graph-based RAG)
- **AI/ML**: AWS Bedrock, OpenAI API, Azure OpenAI, Anthropic, or bring-your-own-LLM
- **Embeddings**: sentence-transformers, OpenAI embeddings
- **Clustering**: scikit-learn, HDBSCAN
- **Task Queue**: Celery + Redis
- **Web Search**: Tavily AI, Serper (fallback)
- **Auth**: JWT, OAuth2, OIDC provider bridge

### Frontend
- **Framework**: React 18 with Next.js 14
- **UI Library**: Tailwind CSS, shadcn/ui, Radix UI
- **State Management**: Zustand, React Query
- **Visualization**: D3.js, Recharts
- **Editor**: Lexical or Tiptap

### AI Workbench
- **Base**: LibreChat (MIT-licensed fork)
- **Database**: MongoDB Atlas M0 (free managed cloud)
- **Deployment**: Cloud Run (internal) + Nginx reverse proxy

### DevOps
- **Containerization**: Docker, Docker Compose
- **Cloud**: Google Cloud Run
- **Proxy**: Nginx (single public entry point)

## Getting Started

### Prerequisites
- Python 3.13+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose

### Quick Start

1. **Clone the repository**
```bash
git clone <repo-url>
cd evols
```

2. **Set up environment variables**
```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your settings
```

3. **Run with Docker Compose**
```bash
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

4. **Configure LLM API Keys** (Required for AI features)
```bash
# After logging in, go to Settings → LLM Settings
# Add your OpenAI, Anthropic, Azure, or AWS Bedrock API key
# See SETUP_GUIDE.md for detailed instructions
```

**Important:** Without LLM keys configured, AI features (copilot, personas, themes) won't work.

### Development Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Key Features Spotlight

### ⚡ Automatic End-to-End Generation
Evols automatically generates your entire product roadmap from customer feedback with a single button:

- **One-Click Workflow**: Upload feedback → Click "Refresh All" → Get prioritized projects
- **Fully Automated Pipeline**: Themes → Initiatives → Projects all generated automatically
- **No Timeouts**: Background processing handles large datasets (thousands of feedback items)
- **Persona Refresh**: Update personas from feedback data independently

**Complete Workflow:**
1. Upload customer feedback (CSV or API)
2. Click "Refresh All" on Initiatives page
3. System automatically:
   - Generates themes from feedback (semantic clustering)
   - Generates initiatives from themes (strategic grouping)
   - Generates projects from initiatives (concrete work items)
   - Calculates RICE priority scores
4. See real-time progress updates (0-100%)
5. View results: themes, initiatives, and prioritized projects

**Example:**
```typescript
// Start automatic generation of everything
const { job_id } = await api.refreshThemesAsync()

// Poll for progress (handled automatically by UI)
useJobPolling({
  jobId: job_id,
  onComplete: (result) => {
    console.log(`Created ${result.themes_created} themes, ` +
                `${result.projects_created} projects!`)
  }
})
```

### 🎯 RICE-Based Project Prioritization
Automatically generate and prioritize projects using the industry-standard RICE framework:

**Formula:** `Priority = (Reach × PersonaWeight × Confidence) / Effort`

- **Reach**: Number of accounts affected by the theme
- **PersonaWeight**: Revenue-weighted persona relevance (via embedding similarity)
- **Confidence**: Theme confidence score from feedback clustering
- **Effort**: Small (1), Medium (2), Large (4), or XLarge (8)

Projects are automatically classified as:
- 🏔️ **Boulders**: Large/XLarge effort (2-4+ weeks)
- ⚡ **Pebbles**: Small/Medium effort (1-14 days)

### 🔐 Smart Authentication
JWT token validation with automatic expiration detection:
- Validates token expiration on every auth check
- Auto-clears expired tokens from localStorage
- Prevents redirect loops and flickering
- Seamless user experience with no timeouts

### 🏗️ Three-Tier Product Hierarchy

Evols implements a clear three-tier hierarchy that connects customer feedback to concrete execution:

```
Theme (Feedback Clusters) → Initiative (Strategic Bets) → Project (Work Items)
```

**1. Themes** - The "What customers are saying" layer
- Auto-generated from feedback clustering
- Metrics: urgency_score, impact_score, confidence_score
- Linked to accounts and revenue data
- Example: "Need for flexible data export formats"

**2. Initiatives** - The "How we respond strategically" layer
- Strategic responses addressing 2-4 related themes
- Shows aggregate metrics from linked themes
- Clear context on which customer problems are being solved
- Example: "Improve Data Export Capabilities"

**3. Projects** - The "What we actually build" layer
- Concrete work items with acceptance criteria
- 🏔️ Boulders (large) vs ⚡ Pebbles (quick wins)
- RICE priority scoring for data-driven decisions
- Example: "Build advanced export engine (Priority: 156.3)"

**Why this matters:**
- **Traceability**: Every project traces back to customer feedback via themes
- **Strategic clarity**: Initiatives explain why we're building something
- **Data-driven**: Priority scores consider customer reach, revenue, and effort
- **Transparency**: PMs can clearly see and explain the reasoning chain

**UI Visualization:**
```
📊 Initiative Card: "Improve Data Export Capabilities"
├── 📋 Addressing 3 Themes:
│   • "Need for flexible data export formats"
│   • "CSV export limitations"
│   • "API access for data extraction"
├── 📈 Aggregate Metrics (from themes):
│   • 127 feedback items from 43 accounts
│   • 78% urgency, 82% impact
└── 🎯 5 Projects (3 boulders, 2 pebbles)
    ├── 🏔️ Build advanced export engine (Priority: 156.3)
    ├── ⚡ Add JSON export option (Priority: 89.1)
    └── ...
```

## Pricing Model

### Free Tier
- Bring your own LLM credentials (Azure, GCP, AWS)
- Up to 5 users per tenant
- All core features included
- No usage limits beyond your LLM provider costs

### Paid Tiers (Coming Soon)
- **Team Plan**: 5+ users with BYOK (bring your own keys)
- **Business Plan**: Use our optimized models (no setup required)
- **Enterprise Plan**: Advanced RBAC, SSO, dedicated support

## Roadmap

### v1.0 (Completed)
- ✅ Data ingestion and knowledge graph
- ✅ Feedback clustering and theme generation
- ✅ Persona digital twins and simulation
- ✅ Multi-tenant architecture

### v1.1 (Completed) - *March 2026*
- ✅ **AI Skills system** — Interactive AI assistants for PM tasks with A/B testing
- ✅ **Context management system** — Unified data ingestion with 20+ source types
- ✅ **Work Context & PM OS** — Personal work context tracking (projects, tasks, relationships, decisions, weekly focus)
- ✅ **Sprint planning skill** — AI-assisted sprint planning with automatic task creation on task board
- ✅ **Tool calling API** — Skills can invoke tools (add_task, update_project, get_work_context, etc.)
- ✅ **Data retention & privacy** — User-controlled policies with encryption and audit logs
- ✅ **Deduplication system** — Three-phase deduplication (content hash, semantic similarity, source grouping)
- ✅ **Support ticket system** — Built-in customer support with admin dashboard
- ✅ **Async background processing** with Celery + Redis for themes, personas, and projects
- ✅ **Three-tier hierarchy** (Theme → Initiative → Project) in UI
- ✅ **Auto-generate prioritized projects** with RICE scoring and boulder/pebble classification
- ✅ **Native async OpenAI/Anthropic clients** — 5x throughput, 3x faster responses
- ✅ **Centralized prompt management** — Version control, A/B testing, hot-reload
- ✅ **Outcome learning loop** — Bayesian learning adjusts priorities based on historical accuracy
- ✅ **Instructor structured parsing** — Type-safe LLM outputs with Pydantic schemas

### v1.2 (Current) - *April 2026*
- ✅ **Team Knowledge Graph** — shared institutional memory across all tools
- ✅ **LightRAG integration** — graph-based knowledge extraction from all ingested data
- ✅ **Evols Claude Code plugin** — team knowledge + redundancy detection in Claude Code
- ✅ **Evols Zed plugin** — PM skills + team knowledge auto-injected into Zed AI threads
- ✅ **Long-lived API keys** — `evols_...` format keys for plugin and service auth
- ✅ **MCP Streamable-HTTP endpoint** — tools: get_team_context, check_redundancy, sync_session_context, plus 10 product-data tools
- ✅ **OIDC provider bridge** — Evols acts as OIDC provider for AI Workbench SSO
- ✅ **LLM proxy** — BYOK proxy for AI Workbench (OpenAI-compatible, all providers)
- ✅ **AI Workbench config** — librechat.yaml wiring LibreChat to Evols auth + LLM proxy
- ✅ **Internet search tools** — Tavily AI (primary) + Serper (fallback) in skills
- ✅ **Skill customizations** — user-level instruction/context/format overrides per skill
- [ ] AI Workbench fork changes (auto-auth hook, theme sync, deploy script)
- [ ] Direct integrations (Intercom, Productboard, Amplitude)
- [ ] Advanced RBAC and permissions

### v1.3 (Next)
- [ ] Experiment tracking and outcome measurement
- [ ] Decision memory and meta-pattern analysis
- [ ] Email notifications for job completion
- [ ] Job history and retry capabilities

### v2.0 (Future)
- [ ] Multi-question sessions and scenario simulations
- [ ] Advanced causal modeling
- [ ] Collaborative decision workflows
- [ ] Mobile app

## Documentation

### Setup & Usage
- **[Setup Guide](SETUP_GUIDE.md)** — Complete setup from fresh database to multi-tenant platform
- **[CSV Upload Guide](docs/CSV_UPLOAD_GUIDE.md)** — How to upload customer feedback
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** — Common issues and solutions

### Developer Tools
- **[Claude Code Plugin README](../evols-claude-plugin/README.md)** — Installation, hooks, MCP tools
- **[Zed Plugin Architecture](../evols-zed-plugin/ARCHITECTURE.md)** — LMDB injection, MCP tools, Option C upstream path
- **[AI Workbench CLAUDE.md](../evols-workbench/CLAUDE.md)** — LibreChat fork structure and code style

### Architecture & Implementation
- **[Three-Tier Architecture](docs/THREE_TIER_ARCHITECTURE.md)** — Theme → Initiative → Project architecture
- **[Data Retention Implementation](DATA_RETENTION_IMPLEMENTATION.md)** — Privacy controls, encryption, and audit logs
- **[Deduplication Implementation](DEDUPLICATION_IMPLEMENTATION.md)** — Three-phase deduplication system
- **[Async API Documentation](docs/ASYNC_API.md)** — Background job processing API
- **[LLM Cost Analysis](docs/LLM_COST_ANALYSIS.md)** — Detailed breakdown of AI costs per VoC ($0.05/VoC)

### Technical References
- **[Technical Debt Fixes](docs/TECHNICAL_DEBT_FIXES.md)** — Native async clients, prompt management, outcome learning
- **[Changelog](CHANGELOG.md)** — Version history and recent changes

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Copyright © 2026 Evols. All rights reserved.

## Support

- Documentation: [docs.evols.ai](https://docs.evols.ai)
- Issues: [GitHub Issues](https://github.com/evols/issues)
- Email: support@evols.ai
