# Unified PM Operating System

> **83 framework-based PM skills** + **knowledge layer** + **memory system** + **daily discipline**

The best of pm-skills, PM-operating-OS, and pm-os-bootstrap merged into one unified system.

---

## What's Inside

### **83 Skills Organized by Category**

```
skills/
├── 01-discovery/           (13 skills) - Brainstorming, assumptions, experiments, OSTs
├── 02-strategy/            (12 skills) - Vision, SWOT, Porter's Five Forces, business models
├── 03-execution/           (15 skills) - PRDs, OKRs, roadmaps, stakeholder maps
├── 04-market-research/     (7 skills)  - Personas, segments, journey maps, competitive
├── 05-data-analytics/      (3 skills)  - SQL, cohort analysis, A/B tests
├── 06-go-to-market/        (6 skills)  - GTM strategy, growth loops, battlecards
├── 07-marketing-growth/    (5 skills)  - Positioning, North Star metrics
├── 08-toolkit/             (4 skills)  - Resume review, legal docs, proofreading
├── 09-os-infrastructure/   (10 skills) - Decision logger, knowledge updater, what-if
└── 10-daily-discipline/    (8 skills)  - Bootstrap, say-no, friday reflection, sweeps
```

### **Three-Layer Architecture**

```
┌─────────────────────────────────────────────────────┐
│         LAYER 3: EXECUTION DISCIPLINE               │
│         (Daily task management)                     │
│  • Morning/evening sweeps                           │
│  • Leverage-tiered task board (🔴🟡🔵⚪🟣⬛)        │
│  • Weekly rhythms (Monday reset, Friday reflection)│
└─────────────────────────────────────────────────────┘
                        ↑ reads/writes
┌─────────────────────────────────────────────────────┐
│         LAYER 2: INTELLIGENCE & MEMORY              │
│         (Knowledge accumulation)                    │
│  • Knowledge layer (strategy, personas, metrics)   │
│  • Memory system (decisions, patterns, outcomes)   │
│  • Agent templates                                  │
└─────────────────────────────────────────────────────┘
                        ↑ uses
┌─────────────────────────────────────────────────────┐
│         LAYER 1: FRAMEWORK SKILLS                   │
│         (PM methodologies)                          │
│  • Teresa Torres (Opportunity Solution Trees)      │
│  • Marty Cagan (Product Strategy)                  │
│  • Alberto Savoia (Pretotyping)                    │
│  • Dan Olsen (Lean Product Playbook)               │
│  • And 8+ more thought leaders                     │
└─────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
unified-pm-os/
├── .clinerules                      ← System prompt (Cline/VS Code)
├── .kiro/steering/
│   └── pm-os-system-prompt.md      ← System prompt (Kiro IDE)
│
├── AGENTS.md                        ← Agent context and workspace memory
│
├── context/                         ← Daily ops (from pm-os-bootstrap)
│   ├── work-context.md              ← Projects, relationships, landscape
│   ├── task-board.md                ← Leverage-tiered tasks
│   └── decision-log.md              ← Decision records
│
├── knowledge/                       ← Domain depth (from PM-operating-OS)
│   ├── _template/                   ← Template for new products
│   ├── examples/                    ← Real company examples (Spotify, Netflix, etc.)
│   └── [your-product]/              ← Customized knowledge
│       ├── strategy.md
│       ├── customer-segments.md
│       ├── competitive-landscape.md
│       ├── value-proposition.md
│       └── metrics-and-targets.md
│
├── memory/                          ← Context graph (from PM-operating-OS)
│   ├── decisions/                   ← Decision traces
│   ├── feedback/                    ← Feedback analysis outputs
│   ├── weekly-plans/                ← Weekly planning outputs
│   ├── strategy-reviews/            ← Strategy scorecards
│   └── skill-outputs/               ← Outputs from skill executions
│       ├── discovery/
│       ├── strategy/
│       └── execution/
│
├── skills/                          ← 83 PM skills (merged)
│   ├── 01-discovery/                (13 skills from pm-skills)
│   ├── 02-strategy/                 (12 skills from pm-skills)
│   ├── 03-execution/                (15 skills from pm-skills)
│   ├── 04-market-research/          (7 skills from pm-skills)
│   ├── 05-data-analytics/           (3 skills from pm-skills)
│   ├── 06-go-to-market/             (6 skills from pm-skills)
│   ├── 07-marketing-growth/         (5 skills from pm-skills)
│   ├── 08-toolkit/                  (4 skills from pm-skills)
│   ├── 09-os-infrastructure/        (10 skills from PM-operating-OS)
│   └── 10-daily-discipline/         (8 skills from pm-os-bootstrap)
│
├── templates/                       ← Jinja2 templates (from PM-operating-OS)
│   ├── rules/
│   ├── agents/
│   └── skills/
│
├── config/                          ← Configuration (from PM-operating-OS)
│   └── pm-os-config.yaml
│
├── inputs/                          ← Raw input artifacts
├── outputs/                         ← Generated artifacts
└── archive/                         ← Historical records
    ├── weekly/
    └── completed-items.md
```

---

## Quick Start

### For Personal Use (IDE)

**1. Bootstrap your system:**
```
Open unified-pm-os/ in your IDE (Cursor/Cline/Kiro)
Say: "Let's bootstrap my PM OS. Run the bootstrap skill."
```

**2. Daily rhythm:**
```
Morning: "Morning. Let's check the board."
Evening: "Sweep time. [what I did] [what came in]"
```

**3. Use skills:**
```
"Help me discover assumptions for [feature]"
"Create a product strategy canvas for [product]"
"Run a SWOT analysis on [initiative]"
"Map stakeholders for [project]"
```

### For Evols Integration (SaaS)

See `EVOLS-INTEGRATION.md` for how to use this as the intelligence layer for Evols.

---

## Skill Categories

### 1. Product Discovery (13 skills)
Ideation, assumptions, experiments, interviews

**Key Skills:**
- `brainstorm-ideas` - Multi-perspective ideation
- `identify-assumptions` - VUVF risk mapping (Value, Usability, Viability, Feasibility)
- `opportunity-solution-tree` - Teresa Torres OST framework
- `brainstorm-experiments` - Pretotyping (Alberto Savoia)
- `interview-script` - JTBD interview prep
- `prioritize-features` - Impact × Effort × Risk matrix

**Example:** `"What are the riskiest assumptions for our AI writing assistant?"`

### 2. Product Strategy (12 skills)
Vision, business models, competitive analysis

**Key Skills:**
- `product-strategy` - 9-section strategy canvas
- `swot-analysis` - Strengths, weaknesses, opportunities, threats
- `porters-five-forces` - Competitive forces analysis
- `value-proposition` - 6-part JTBD value prop
- `lean-canvas` - Lean startup business model
- `pricing-strategy` - Pricing models and willingness-to-pay

**Example:** `"Create a product strategy canvas for our B2B analytics platform"`

### 3. Execution (15 skills)
PRDs, OKRs, roadmaps, sprints, stakeholder management

**Key Skills:**
- `create-prd` - Comprehensive 8-section PRD
- `brainstorm-okrs` - Team-level OKRs aligned with company objectives
- `stakeholder-map` - Power × Interest grid with communication plan
- `pre-mortem` - Tigers/Paper Tigers/Elephants risk analysis
- `sprint-plan` - Capacity estimation and story selection
- `prioritization-frameworks` - Reference guide (RICE, ICE, Kano, etc.)

**Example:** `"Write a PRD for our smart notification system"`

### 4. Market Research (7 skills)
Personas, segmentation, competitive analysis

**Key Skills:**
- `user-personas` - Create personas from research data
- `customer-journey-map` - End-to-end journey with touchpoints
- `market-sizing` - TAM, SAM, SOM calculation
- `competitor-analysis` - Strengths, weaknesses, differentiation
- `sentiment-analysis` - Theme extraction from feedback

**Example:** `"Estimate TAM/SAM/SOM for an AI code review tool"`

### 5. Data Analytics (3 skills)
SQL, cohort analysis, A/B testing

**Key Skills:**
- `sql-queries` - Generate SQL from natural language
- `cohort-analysis` - Retention curves and engagement trends
- `ab-test-analysis` - Statistical significance and ship/stop decisions

**Example:** `"Analyze this A/B test - is it significant at 95% confidence?"`

### 6. Go-to-Market (6 skills)
GTM strategy, growth loops, battlecards

**Key Skills:**
- `gtm-strategy` - Full GTM: channels, messaging, metrics
- `beachhead-segment` - Identify first market segment
- `growth-loops` - Design sustainable flywheels
- `competitive-battlecard` - Sales-ready objection handling

**Example:** `"Design a growth loop for our B2B SaaS freemium product"`

### 7. Marketing & Growth (5 skills)
Positioning, North Star metrics, value props

**Key Skills:**
- `north-star-metric` - Define NSM + input metrics
- `positioning-ideas` - Differentiated positioning angles
- `value-prop-statements` - Marketing/sales messaging
- `product-name` - Name brainstorming

**Example:** `"What's a good North Star Metric for our marketplace?"`

### 8. Toolkit (4 skills)
Resume review, legal documents, proofreading

**Key Skills:**
- `review-resume` - PM resume best practices (XYZ+S formula)
- `draft-nda` - Non-disclosure agreements
- `privacy-policy` - GDPR/CCPA compliant policies
- `grammar-check` - Grammar and flow checking

**Example:** `"Review my PM resume against best practices"`

### 9. OS Infrastructure (10 skills)
Decision logging, knowledge management, simulation

**Key Skills:**
- `decision-logger` - Structured decision traces
- `knowledge-updater` - Update knowledge docs with snapshots
- `what-if` - Simulate impact of proposed decisions
- `continual-learning` - Extract preferences from conversations

**Example:** `"Log this decision: prioritized export engine for Q2"`

### 10. Daily Discipline (8 skills)
Task management, boundaries, reflection

**Key Skills:**
- `bootstrap` - First-run onboarding
- `say-no-playbook` - Boundary protection frameworks
- `action-item-harvester` - Extract action items from meetings
- `friday-reflection` - Weekly wrap and archiving
- `context-refresh` - System health check

**Example:** `"Friday reflection - how did the week go?"`

---

## How Skills Work

### Skills Reference Knowledge

```markdown
# knowledge/acme-corp/strategy.md
Product: Enterprise Analytics
Strategic Pillars:
  1. Self-serve analytics (no SQL)
  2. Cross-functional collaboration
  3. Real-time insights
```

When you run a skill:
```
"Design our North Star Metric"

→ Skill reads knowledge/acme-corp/strategy.md
→ Returns personalized output:
  "Based on your strategic pillar #1 (Self-serve analytics),
   your North Star should be Weekly Active Analysts (WAA)"
```

### Skills Write to Memory

```
"Identify assumptions for export feature"

→ Skill executes assumption mapping framework
→ Writes output to memory/skill-outputs/discovery/2026-03-18-assumptions.md
→ Future skills can reference this work
```

### Retrospective Agent Uses Memory

```
"What patterns do you see in our decisions?"

→ Reads memory/skill-outputs/discovery/*.md
→ Reads memory/decisions/*.md
→ Returns pattern analysis:
  - "You identified 47 assumptions but only validated 6%"
  - "Strategic drift detected: moving away from 'Self-serve' pillar"
```

---

## Usage Modes

### Mode 1: Personal PM OS (Individual Use)

**Setup:** 15 minutes
- Open in IDE (Cursor/Cline/Kiro)
- Run bootstrap skill
- Start daily sweeps

**Use Case:** Individual PM or small team
**Cost:** Free (just LLM API costs)

### Mode 2: Evols Intelligence Layer (Team SaaS)

**Setup:** Integration project (see EVOLS-INTEGRATION.md)
- Adapt skills for web platform
- Connect to Evols data layer
- Add multi-tenancy

**Use Case:** Selling PM platform to other teams
**Cost:** SaaS pricing model

---

## Credits

**Skills Framework:** pm-skills by Akshay Saraswat
- 65 skills based on Teresa Torres, Marty Cagan, Alberto Savoia, Dan Olsen, and more

**Knowledge & Memory:** PM-operating-OS by Akshay Saraswat
- Knowledge layer, memory system, MCP integrations

**Daily Discipline:** pm-os-bootstrap by (original author)
- Task management, daily rhythms, operating principles
- File-based personal operating system

---

## Next Steps

1. **For Personal Use:** Run `bootstrap` skill to get started
2. **For Evols Integration:** See `EVOLS-INTEGRATION.md`
3. **Customize:** Edit knowledge/ folder for your domain
4. **Use Skills:** Start with discovery or strategy workflows
5. **Build Habit:** Daily sweeps for 1 week to establish rhythm
