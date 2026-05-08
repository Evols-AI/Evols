import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight, CheckCircle2,
  Download, Package, ChevronDown, BookOpen,
} from 'lucide-react'
import { SiClaude, SiZedindustries, SiOpenai } from 'react-icons/si'

function SiCursor({ className }: { className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  )
}
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import SpotlightCard from '@/components/SpotlightCard'

type Step = { title: string; body: string; code?: string }
type StepGroup = { label: string; steps: Step[] }

const PLUGINS = [
  {
    id: 'claude-code',
    icon: SiClaude,
    name: 'Claude Code',
    description:
      'The deepest integration. Hooks fire at every lifecycle event — session start, each prompt, every tool call, session end. Team knowledge is injected automatically before your first message. Redundant Bash and web fetches are intercepted before they run.',
    features: [
      'Auto-injects relevant team knowledge at session start',
      'Intercepts redundant tool calls before they execute',
      'Per-turn token tracking and cost display',
      'Haiku-powered knowledge sync at session end',
      'LightRAG forwarding for product intelligence',
      'Full file provenance tracking',
    ],
    installLabel: 'Install via marketplace',
    installHref: 'https://github.com/Evols-AI/evols-plugins',
    stepGroups: [
      {
        label: 'CLI',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Add the Evols marketplace',
            body: 'In your terminal, run:',
            code: '/plugin marketplace add Evols-AI/evols-plugins',
          },
          {
            title: 'Install the plugin',
            body: 'Then install:',
            code: '/plugin install evols@evols-ai',
          },
          {
            title: 'Enter your API key',
            body: 'Claude Code will prompt for your Evols API key. Paste the key from step 1. Optionally set your plan (pro / max / team / enterprise).',
          },
          {
            title: 'Start a session',
            body: 'Open any project in Claude Code. Evols injects team knowledge automatically at session start.',
          },
        ],
      },
      {
        label: 'VS Code',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Open VS Code settings JSON',
            body: 'Press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux), then type "Open User Settings JSON" and select Preferences: Open User Settings (JSON). This opens the raw JSON file — not the UI settings panel.',
          },
          {
            title: 'Add the plugin config',
            body: 'Add the following block inside the top-level { } object:',
            code: `"claude.plugins": {
  "evols": {
    "EVOLS_API_KEY": "evols_your_key_here",
    "EVOLS_API_URL": "https://api.evols.ai",
    "EVOLS_PLAN": "pro"
  }
}`,
          },
          {
            title: 'Add the marketplace',
            body: 'In the Claude Code panel, run:',
            code: '/plugin marketplace add Evols-AI/evols-plugins',
          },
          {
            title: 'Install the plugin',
            body: 'Then install:',
            code: '/plugin install evols@evols-ai',
          },
          {
            title: 'Reload the window',
            body: 'Press Cmd+Shift+P → Developer: Reload Window. Evols activates and injects team knowledge at the start of every session.',
          },
        ],
      },
    ] as StepGroup[],
  },
  {
    id: 'zed',
    icon: SiZedindustries,
    name: 'Zed',
    description:
      'A compiled Rust binary — zero runtime dependencies, instant startup. Injects behavioural rules and the full skills catalogue at thread start. All 23 Evols tools available, including 11 product intelligence tools: personas, pain points, feature requests, persona digital twins, and vote simulation.',
    features: [
      'Skills catalogue injected at every AI thread start',
      'Full 23-tool suite including product intelligence',
      'Engage AI-powered persona digital twins',
      'Simulate persona votes on strategic decisions',
      'Session-end knowledge sync via stdin EOF',
      'Zero Python, zero runtime dependencies',
    ],
    installLabel: 'Download plugin',
    installHref: 'https://github.com/Evols-AI/evols-plugins/releases/download/1.9.1/zed-v1.9.1.zip',
    stepGroups: [
      {
        label: 'Zed',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Download the plugin',
            body: 'Download Evols-zed-plugin-dist.zip from the link above and unzip it. You\'ll get a folder with extension.toml, extension.wasm, and bin/.',
          },
          {
            title: 'Install as a dev extension',
            body: 'In Zed: Extensions → Install Dev Extension → select the unzipped folder. The Evols context server appears in the server list.',
          },
          {
            title: 'Add your API key',
            body: 'Open Zed settings (Cmd+Shift+P → zed: open settings) and add:',
            code: `"context_servers": {
  "evols": {
    "settings": {
      "api_url": "https://api.evols.ai",
      "api_key": "evols_your_key_here",
      "plan_type": "pro"
    }
  }
}`,
          },
          {
            title: 'Enable the context server',
            body: 'In Zed: Extensions → Evols → toggle the context server on. Evols connects and injects team knowledge at the start of every AI thread.',
          },
        ],
      },
    ] as StepGroup[],
  },
  {
    id: 'cursor',
    icon: SiCursor,
    name: 'Cursor',
    description:
      'Hooks fire at every key lifecycle event — session start, before each prompt, after every tool call, and session end. Team knowledge is injected automatically. Redundant work is intercepted before it runs. Installed via a single shell script — no runtime dependencies.',
    features: [
      'Auto-injects relevant team knowledge at session start',
      'beforeSubmitPrompt fires before every message for redundancy check',
      'postToolUse intercepts redundant Bash and web fetches',
      'Per-turn token tracking and cost display',
      'Haiku-powered knowledge sync at session end',
      'MCP server exposes all 23 Evols tools in Cursor chat',
    ],
    installLabel: 'Download plugin',
    installHref: 'https://github.com/Evols-AI/evols-plugins/tree/main/cursor',
    stepGroups: [
      {
        label: 'macOS / Linux',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Run the installer',
            body: 'Paste this into your terminal:',
            code: 'curl -fsSL https://raw.githubusercontent.com/Evols-AI/evols-plugins/main/cursor/install.sh | sh',
          },
          {
            title: 'Add your API key',
            body: 'Open ~/.cursor/mcp.json and set your key in the evols server env block:',
            code: '"EVOLS_API_KEY": "evols_your_key_here"',
          },
          {
            title: 'Restart Cursor',
            body: 'Quit and reopen Cursor. Evols injects team knowledge automatically at the start of every session.',
          },
        ],
      },
      {
        label: 'Windows',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Run the installer',
            body: 'Paste this into PowerShell (run as Administrator):',
            code: 'iwr -useb https://raw.githubusercontent.com/Evols-AI/evols-plugins/main/cursor/install.ps1 | iex',
          },
          {
            title: 'Add your API key',
            body: 'Open %USERPROFILE%\\.cursor\\mcp.json and set your key in the evols server env block:',
            code: '"EVOLS_API_KEY": "evols_your_key_here"',
          },
          {
            title: 'Restart Cursor',
            body: 'Quit and reopen Cursor. Evols injects team knowledge automatically at the start of every session.',
          },
        ],
      },
    ] as StepGroup[],
  },
  {
    id: 'codex',
    icon: SiOpenai,
    name: 'OpenAI Codex',
    description:
      'Brings the complete Claude Code hook layer to Codex. PreToolUse fires before every Bash and web fetch — redundant calls are caught before they run, not after. Per-turn token accumulation across the full session. All 23 Evols tools available via MCP.',
    features: [
      'PreToolUse interception before redundant tool calls',
      'Per-turn token and cost accumulation',
      'Team knowledge injected at session start',
      'Prompt-level redundancy check on every message',
      'Full 23-tool MCP suite',
      'Session-end Haiku sync via stdin EOF',
    ],
    installLabel: 'Install via marketplace',
    installHref: 'https://github.com/Evols-AI/evols-plugins',
    stepGroups: [
      {
        label: 'Codex',
        steps: [
          {
            title: 'Get your API key',
            body: 'Sign in to evols.ai → Settings → API Keys → New Key. Copy the key starting with evols_.',
          },
          {
            title: 'Add the Evols marketplace',
            body: 'In Codex, open Manage Plugins. Click the + button next to the plugin search box and enter:',
            code: 'https://github.com/Evols-AI/evols-plugins',
          },
          {
            title: 'Install the plugin',
            body: 'Evols appears in the plugin list. Click Install.',
          },
          {
            title: 'Add your API key to config',
            body: 'Codex does not prompt for credentials during install. Open ~/.codex/config.toml and add these lines under [shell_environment_policy.set]:',
            code: `EVOLS_API_KEY = "evols_your_key_here"
EVOLS_API_URL = "https://api.evols.ai"
EVOLS_PLAN = "pro"`,
          },
          {
            title: 'Restart Codex',
            body: 'Quit and reopen Codex. Evols injects team knowledge automatically at the start of every session.',
          },
        ],
      },
    ] as StepGroup[],
  },
]

const SHARED_CAPABILITIES = [
  { label: 'Team knowledge graph', description: 'All plugins share the same graph. Knowledge created in Claude Code is instantly available in Zed.' },
  { label: 'AI skills catalogue', description: 'Behavioural rules and the full skills library, injected at session start on every platform.' },
  { label: 'Redundancy detection', description: 'Two tiers: hard match (≥75%) blocks duplicate work; soft match (≥55%) surfaces related context.' },
  { label: 'Knowledge sync', description: 'sync_subtask_context for focused work units; sync_session_context for overall synthesis.' },
  { label: 'Product intelligence', description: 'Personas, pain points, feature requests, competitors, themes, and persona twins.' },
  { label: 'Quota visibility', description: 'get_quota_status shows team token investment, savings, and ROI across all sessions.' },
]

function PluginCard({ plugin, activeId, onInstall }: {
  plugin: typeof PLUGINS[0]
  activeId: string | null
  onInstall: (id: string) => void
}) {
  const Icon = plugin.icon
  const isActive = activeId === plugin.id
  const hasSteps = plugin.stepGroups.length > 0

  return (
    <SpotlightCard className={isActive ? 'ring-1 ring-primary/40' : ''}>
      <div className="p-8 flex flex-col gap-6 h-full">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">{plugin.name}</h2>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">{plugin.description}</p>

        <ul className="space-y-2">
          {plugin.features.map(f => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 mt-auto pt-2">
          {plugin.installHref ? (
            <a
              href={plugin.installHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/85 transition-all"
            >
              <Download className="w-4 h-4" />
              {plugin.installLabel}
            </a>
          ) : (
            <span className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-muted text-muted-foreground cursor-not-allowed">
              <Package className="w-4 h-4" />
              {plugin.installLabel}
            </span>
          )}
          {hasSteps && (
            <button
              onClick={() => onInstall(plugin.id)}
              className={`flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border transition-all ${
                isActive
                  ? 'border-primary/40 text-primary bg-primary/5'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/30'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Installation
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isActive ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </SpotlightCard>
  )
}

function InstallSteps({ plugin }: { plugin: typeof PLUGINS[0] }) {
  const [activeTab, setActiveTab] = useState(plugin.stepGroups.length > 1 ? 1 : 0)
  const group = plugin.stepGroups[activeTab]

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-8">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h3 className="text-lg font-semibold text-foreground">
          Installing Evols for {plugin.name}
        </h3>
        {plugin.stepGroups.length > 1 && (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            {plugin.stepGroups.map((g, i) => (
              <button
                key={g.label}
                onClick={() => setActiveTab(i)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === i
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <ol className="space-y-6">
        {group.steps.map((step, i) => (
          <li key={i} className="flex gap-4">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
              {i + 1}
            </div>
            <div className="flex flex-col gap-2 min-w-0">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              {step.code && (
                <pre className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap break-all">
                  {step.code}
                </pre>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function PluginsPage() {
  const [activePlugin, setActivePlugin] = useState<string | null>(null)

  const handleInstall = (id: string) => {
    setActivePlugin(prev => prev === id ? null : id)
    if (activePlugin !== id) {
      setTimeout(() => {
        document.getElementById('install-steps')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }

  const activePluginData = PLUGINS.find(p => p.id === activePlugin)

  return (
    <>
      <Head>
        <title>Plugins — Evols</title>
        <meta name="description" content="Evols plugins for Claude Code, Zed, Cursor, and OpenAI Codex. Team knowledge graph, redundancy detection, and product intelligence in every AI session." />
      </Head>

      <Header variant="landing" />

      <main className="pt-24 pb-20">
        <section className="max-w-4xl mx-auto px-6 text-center mb-20">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary mb-6">
            <Package className="w-3.5 h-3.5" />
            Available for Claude Code, Zed, Cursor, and Codex
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground mb-5">
            One knowledge graph,<br />every AI tool
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Evols plugins connect your AI coding and PM tools to a shared team knowledge graph.
            Context built in one session is available in every other — regardless of tool.
          </p>
        </section>

        <section className="max-w-6xl mx-auto px-6 mb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PLUGINS.map(p => (
              <PluginCard
                key={p.id}
                plugin={p}
                activeId={activePlugin}
                onInstall={handleInstall}
              />
            ))}
          </div>

          {activePluginData && activePluginData.stepGroups.length > 0 && (
            <div id="install-steps" className="mt-6">
              <InstallSteps plugin={activePluginData} />
            </div>
          )}
        </section>

        <section className="max-w-4xl mx-auto px-6 mb-20">
          <h2 className="text-2xl font-semibold text-foreground mb-2 text-center">Shared across all plugins</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Every plugin connects to the same backend. Knowledge is portable across tools.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SHARED_CAPABILITIES.map(cap => (
              <div key={cap.label} className="flex items-start gap-3 p-5 rounded-xl border border-border bg-card">
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{cap.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-3">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Get your API key, install the plugin for your tool, and your first session is already smarter than the last.
          </p>
          <div className="flex items-center gap-4 justify-center flex-wrap">
            <Link
              href="/register"
              className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/85 transition-all"
            >
              Get early access <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/docs/integrations"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
