# ProductOS - Product Decision Operating System

**Mission:** Help senior PMs at scaling B2B SaaS companies turn all their customer and product data into fast, explainable product decisions they can confidently defend and execute.

## Overview

ProductOS is an AI-native Product Decision OS that helps product managers:
- **Consolidate fragmented evidence** from feedback tools, CRM, analytics, and support tickets
- **Auto-cluster feedback** into themes with revenue impact and urgency
- **Generate evidence-backed decision briefs** with clear options, tradeoffs, and recommendations
- **Simulate persona digital twins** for product validation and trade-off decisions
- **Track decisions and outcomes** to build institutional product memory

## Features

### Core Features (v1)
1. **Data Ingestion & Knowledge Graph**
   - Upload feedback, accounts, and initiatives via CSV
   - Auto-categorize into tech debt, features, bugs
   - Build product knowledge graph with visualization

2. **AI-Assisted Synthesis** ⚡ *Now with Async Processing*
   - Auto-cluster feedback into themes using embeddings + LLM
   - Link themes to accounts and ARR
   - Calculate urgency and severity scores
   - Generate strategic initiatives from themes
   - **NEW**: Background processing for large datasets (no timeouts!)
   - **NEW**: Real-time progress tracking with status updates
   - **NEW**: Auto-generate prioritized projects (boulders & pebbles) with RICE scoring

3. **Decision Workbench**
   - Visual workspace for exploring opportunities
   - Filter by segment, time window, and initiatives
   - AI-generated roadmap options with pros/cons
   - Interactive editing and regeneration

4. **Decision Brief Generator**
   - One-click export to Markdown/PDF
   - Problem context, options, tradeoffs, recommendation
   - Full citations back to feedback and accounts
   - Confidence scores for all claims

5. **Persona Digital Twins**
   - Auto-generate personas from customer segments
   - LLM-powered response simulation
   - "Ask Persona" chat interface
   - Trade-off voting with confidence scores

6. **Multi-Tenancy & Auth**
   - Three role types: Product Admin, Tenant Admin, User
   - Session management and multi-device support
   - API key management for LLM providers
   - User preferences and settings

## Architecture

```
ProductOS/
├── backend/          # Python FastAPI backend
│   ├── app/
│   │   ├── api/      # API endpoints
│   │   ├── core/     # Business logic
│   │   ├── models/   # Database models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── services/ # AI, clustering, persona services
│   │   └── utils/    # Utilities
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
└── docker/          # Docker configurations
    ├── backend.Dockerfile
    ├── frontend.Dockerfile
    └── docker-compose.yml
```

## Tech Stack

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **Database**: PostgreSQL with pgvector
- **AI/ML**: OpenAI API, Azure OpenAI, or bring-your-own-LLM
- **Embeddings**: sentence-transformers, OpenAI embeddings
- **Clustering**: scikit-learn, HDBSCAN
- **Auth**: JWT, OAuth2

### Frontend
- **Framework**: React 18 with Next.js 14
- **UI Library**: Tailwind CSS, shadcn/ui, Radix UI
- **State Management**: Zustand, React Query
- **Visualization**: D3.js, Recharts, React Flow (for knowledge graph)
- **Charts**: Recharts, Victory
- **Editor**: Lexical or Tiptap

### DevOps
- **Containerization**: Docker, Docker Compose
- **Orchestration**: Kubernetes (future)
- **Monitoring**: Prometheus, Grafana (future)

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose

### Quick Start

1. **Clone the repository**
```bash
git clone <repo-url>
cd ProductOS
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
ProductOS automatically generates your entire product roadmap from customer feedback with a single button:

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

ProductOS implements a clear three-tier hierarchy that connects customer feedback to concrete execution:

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
- ✅ Decision workbench and brief generator
- ✅ Persona digital twins and simulation
- ✅ Multi-tenant architecture

### v1.1 (Current) - *Released March 2026*
- ✅ **Async background processing** for themes, personas, and projects
- ✅ **Real-time progress tracking** with status updates
- ✅ **Strategic Initiatives page** (renamed from Themes)
- ✅ **Three-tier hierarchy** (Theme → Initiative → Project) properly exposed in UI
- ✅ **Linked themes display** showing which customer problems each initiative addresses
- ✅ **Aggregate metrics** calculated from linked themes for data-driven decisions
- ✅ **Auto-generate prioritized projects** with RICE scoring
- ✅ **Boulder/Pebble classification** for effort sizing
- ✅ **JWT expiration validation** and improved auth flow
- ✅ **Flicker-free authentication** experience
- ✅ **Native async OpenAI/Anthropic clients** - 5x throughput, 3x faster responses
- ✅ **Centralized prompt management** - Version control, A/B testing, hot-reload
- ✅ **Outcome learning loop** - Bayesian learning adjusts priorities based on historical accuracy
- ✅ **Celery durable task queue** - Production-ready background jobs with Redis
- ✅ **Instructor structured parsing** - Type-safe LLM outputs with Pydantic schemas
- ✅ **Explicit transaction management** - @transactional decorator for commit control
- [ ] Direct integrations (Intercom, Productboard, Amplitude)
- [ ] Advanced RBAC and permissions

### v1.2 (Next)
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

- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[CSV Upload Guide](docs/CSV_UPLOAD_GUIDE.md)** - How to upload customer feedback
- **[Async API Documentation](docs/ASYNC_API.md)** - Background job processing API
- **[Three-Tier Architecture](docs/THREE_TIER_ARCHITECTURE.md)** - Theme → Initiative → Project architecture
- **[LLM Cost Analysis](docs/LLM_COST_ANALYSIS.md)** - Detailed breakdown of AI costs per VoC ($0.05/VoC)
- **[Technical Debt Fixes](docs/TECHNICAL_DEBT_FIXES.md)** - Native async clients, prompt management, outcome learning
- **[Engineering Gaps](docs/ENGINEERING_GAPS.md)** - Architectural issues analysis and solutions
- **[Engineering Gaps Migration](docs/ENGINEERING_GAPS_MIGRATION.md)** - ✅ **Step-by-step migration guide for all fixes**
- **[Changelog](CHANGELOG.md)** - Version history and recent changes

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Copyright © 2026 ProductOS. All rights reserved.

## Support

- Documentation: [docs.productos.ai](https://docs.productos.ai)
- Issues: [GitHub Issues](https://github.com/productos/issues)
- Email: support@productos.ai
