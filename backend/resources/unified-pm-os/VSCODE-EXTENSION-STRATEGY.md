# VS Code Extension Strategy for Evols

## Executive Summary

**Key Insight:** Build a VS Code extension as an alternative frontend to Evols, providing IDE-native experience with zero-setup team collaboration.

**Strategic Positioning:**
- **For Technical PMs:** "Cline's IDE experience + zero setup + team sync"
- **For Non-Technical PMs:** "Web-based PM assistant" (existing web UI)
- **Same Backend:** Dual frontend strategy serving both audiences

**Timeline:** 3 weeks for MVP extension + 4 weeks for unified-pm-os backend integration

**Differentiation:** Beats Cline (zero setup), beats Web UI (native IDE), beats git (visual sync)

---

## The Reality Check That Led Here

### What We Learned

**Cline + unified-pm-os + MCP + git ≈ 90% of Evols functionality**

For a technical team that:
- ✅ Is comfortable with git
- ✅ Can configure MCP servers
- ✅ Works in IDEs daily

**The free alternative (Cline) was almost as good as Evols.**

### The Pivot

Instead of competing with Cline, **absorb Cline's strengths:**
- IDE-native experience ✓
- Local file editing ✓
- Developer-friendly ✓

**But add what Cline can't do easily:**
- Zero setup (no MCP config)
- Real-time team sync (better than git)
- Multi-tenancy (proper auth)
- Turn-key tool access

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│           VS Code (User's IDE)                  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │   Evols Extension (TypeScript)           │  │
│  │                                          │  │
│  │  • Sidebar UI (skills browser)          │  │
│  │  • Command palette integration          │  │
│  │  • File watcher (knowledge/, memory/)   │  │
│  │  • WebSocket client (real-time sync)    │  │
│  │  • Inline skill suggestions             │  │
│  └──────────────────────────────────────────┘  │
│                    ↕ HTTPS/WSS                  │
└─────────────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────┐
│        Evols Backend (Existing!)                │
│                                                 │
│  • FastAPI REST API (already exists)           │
│  • PostgreSQL (multi-tenant)                   │
│  • Skill execution (already exists)            │
│  • Tool registry (already exists)              │
│  • Auth/tenancy (already exists)               │
│  • unified-pm-os integration (to be added)     │
└─────────────────────────────────────────────────┘
```

**Key Point:** Backend work (unified-pm-os integration) is required regardless of frontend choice. Extension is an ADDITIONAL frontend option.

---

## User Experience

### Installation (One-Time, 2 Minutes)

```bash
# In VS Code Extensions Marketplace
1. Search "Evols"
2. Click Install
3. Click "Sign in to Evols"
4. Select workspace folder
```

**No MCP setup. No git configuration. Just works.**

---

### Daily Workflow

**File Structure:**

```
unified-pm-os/
├── knowledge/
│   ├── acme-corp/
│   │   ├── strategy.md          ← Edit locally in VS Code
│   │   ├── customer-segments.md ← Auto-syncs to Evols backend
│   │   └── competitive.md       ← Team sees changes real-time
├── memory/
│   ├── decisions/
│   │   └── 2026-03-18-export.md ← Claude writes locally
│   │                             ← Auto-syncs to teammates
│   └── skill-outputs/
│       └── discovery/
│           └── 2026-03-18-assumptions.md
└── skills/
    └── (read-only, loaded from Evols backend)
```

**Using Skills:**

```
Option 1: Command Palette
Cmd+Shift+P → "Evols: Identify Assumptions"
→ Opens chat panel in VS Code
→ Claude runs skill (on Evols backend)
→ Writes output to memory/skill-outputs/
→ Auto-syncs to team

Option 2: Sidebar
→ Click "Evols Skills" in sidebar
→ Browse by category (Discovery, Strategy, Execution...)
→ Click skill name
→ Opens chat interface

Option 3: Inline (Context-Aware)
→ Highlight text in any file
→ Right-click → "Evols: Analyze with skill..."
→ Extension suggests relevant skills
→ Select skill → runs with highlighted text as context
```

**Team Collaboration:**

```
Timeline:
10:00 AM - PM 1: Edits knowledge/strategy.md locally
           → Extension detects change
           → Auto-syncs to Evols backend

10:05 AM - PM 2: Gets notification in VS Code
           "strategy.md updated by sarah@company.com"
           → Click notification
           → Shows diff view
           → Options: [Pull Changes] [View Diff] [Ignore]

10:06 AM - PM 2: Clicks "Pull Changes"
           → Local file updates
           → No git commands needed

Like Google Docs, but for markdown files in IDE.
```

---

## Technical Implementation

### 1. VS Code Extension (NEW - 3 weeks)

#### Core Extension Logic

**File:** `vscode-extension/src/extension.ts`

```typescript
import * as vscode from 'vscode';
import { EvolsClient } from './client';
import { FileWatcher } from './fileWatcher';
import { SkillsProvider } from './skillsProvider';
import { SyncEngine } from './sync';

export function activate(context: vscode.ExtensionContext) {
    console.log('Evols extension activated');

    // 1. Initialize Evols API client
    const client = new EvolsClient(
        getApiUrl(),      // https://api.evols.com or localhost
        getAuthToken()    // From VS Code secret storage
    );

    // 2. Register sidebar for skills browser
    const skillsProvider = new SkillsProvider(client);
    vscode.window.registerTreeDataProvider('evolsSkills', skillsProvider);

    // 3. Register commands

    // Run skill from command palette
    context.subscriptions.push(
        vscode.commands.registerCommand('evols.runSkill', async (skillId) => {
            const panel = vscode.window.createWebviewPanel(
                'evolsSkill',
                'Evols Skill',
                vscode.ViewColumn.Two,
                { enableScripts: true, retainContextWhenHidden: true }
            );

            // Create chat interface in webview panel
            panel.webview.html = getSkillWebview(skillId);

            // Handle messages from webview
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'sendMessage':
                            const response = await client.chat({
                                skill_id: skillId,
                                message: message.text,
                                conversation_id: message.conversationId
                            });
                            panel.webview.postMessage({
                                command: 'displayResponse',
                                response: response
                            });
                            break;
                    }
                }
            );
        })
    );

    // Run skill on selected text
    context.subscriptions.push(
        vscode.commands.registerCommand('evols.runSkillOnSelection', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const selection = editor.document.getText(editor.selection);
            const skills = await client.getSuggestedSkills(selection);

            const skillName = await vscode.window.showQuickPick(
                skills.map(s => s.name),
                { placeHolder: 'Select skill to run on selection' }
            );

            if (skillName) {
                const skill = skills.find(s => s.name === skillName);
                vscode.commands.executeCommand('evols.runSkill', skill.id);
            }
        })
    );

    // Sign in command
    context.subscriptions.push(
        vscode.commands.registerCommand('evols.signIn', async () => {
            const email = await vscode.window.showInputBox({
                prompt: 'Enter your Evols email',
                placeHolder: 'you@company.com'
            });

            const password = await vscode.window.showInputBox({
                prompt: 'Enter your password',
                password: true
            });

            if (email && password) {
                try {
                    const token = await client.signIn(email, password);
                    await context.secrets.store('evolsToken', token);
                    vscode.window.showInformationMessage('Signed in to Evols!');
                    // Refresh skills tree
                    skillsProvider.refresh();
                } catch (err) {
                    vscode.window.showErrorMessage(`Sign in failed: ${err.message}`);
                }
            }
        })
    );

    // 4. Watch for file changes (auto-sync to backend)
    const watcher = new FileWatcher(client);
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (workspaceFolder) {
        watcher.watchFolder(workspaceFolder);
    }

    // 5. Start real-time sync engine (receive updates from teammates)
    const syncEngine = new SyncEngine(client);
    syncEngine.start();

    // 6. Status bar item
    const statusBar = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBar.text = "$(check) Evols";
    statusBar.tooltip = "Connected to Evols";
    statusBar.show();
    context.subscriptions.push(statusBar);
}

export function deactivate() {
    console.log('Evols extension deactivated');
}
```

#### Real-Time Sync Engine

**File:** `vscode-extension/src/sync.ts`

```typescript
import * as vscode from 'vscode';
import * as WebSocket from 'ws';
import { EvolsClient } from './client';

interface FileUpdate {
    type: 'file_changed';
    path: string;
    content: string;
    user: string;
    timestamp: string;
}

export class SyncEngine {
    private ws?: WebSocket;
    private reconnectTimeout?: NodeJS.Timeout;

    constructor(private client: EvolsClient) {}

    async start() {
        await this.connect();
    }

    private async connect() {
        const token = await this.client.getToken();
        const wsUrl = `wss://api.evols.com/sync?token=${token}`;

        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
            console.log('Connected to Evols sync');
            vscode.window.showInformationMessage('Evols: Real-time sync active');
        });

        this.ws.on('message', async (data: WebSocket.Data) => {
            const update = JSON.parse(data.toString()) as FileUpdate;
            await this.handleRemoteChange(update);
        });

        this.ws.on('close', () => {
            console.log('Disconnected from Evols sync');
            // Attempt reconnect after 5 seconds
            this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
        });

        this.ws.on('error', (err) => {
            console.error('WebSocket error:', err);
        });
    }

    async handleRemoteChange(update: FileUpdate) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const localPath = vscode.Uri.joinPath(workspaceFolder.uri, update.path);

        try {
            const localContent = await vscode.workspace.fs.readFile(localPath);
            const localText = Buffer.from(localContent).toString('utf8');

            if (localText !== update.content) {
                // File has diverged - show notification
                const action = await vscode.window.showInformationMessage(
                    `${update.path} was updated by ${update.user}`,
                    'View Changes',
                    'Pull Changes',
                    'Ignore'
                );

                if (action === 'View Changes') {
                    await this.showDiff(localPath, localText, update.content);
                } else if (action === 'Pull Changes') {
                    await this.pullChanges(localPath, update.content);
                }
            }
        } catch (err) {
            // File doesn't exist locally - create it
            await vscode.workspace.fs.writeFile(
                localPath,
                Buffer.from(update.content, 'utf8')
            );

            vscode.window.showInformationMessage(
                `New file created by ${update.user}: ${update.path}`
            );
        }
    }

    private async showDiff(
        localPath: vscode.Uri,
        localContent: string,
        remoteContent: string
    ) {
        // Create temporary file with remote content
        const tempUri = vscode.Uri.file(
            `/tmp/evols-remote-${Date.now()}.md`
        );
        await vscode.workspace.fs.writeFile(
            tempUri,
            Buffer.from(remoteContent, 'utf8')
        );

        // Open diff editor
        await vscode.commands.executeCommand(
            'vscode.diff',
            tempUri,
            localPath,
            'Remote ↔ Local'
        );
    }

    private async pullChanges(localPath: vscode.Uri, content: string) {
        await vscode.workspace.fs.writeFile(
            localPath,
            Buffer.from(content, 'utf8')
        );

        vscode.window.showInformationMessage(
            `Pulled latest changes for ${localPath.fsPath}`
        );
    }

    stop() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}
```

#### File Watcher (Local → Remote Sync)

**File:** `vscode-extension/src/fileWatcher.ts`

```typescript
import * as vscode from 'vscode';
import { EvolsClient } from './client';

export class FileWatcher {
    private watchers: vscode.FileSystemWatcher[] = [];
    private syncQueue: Map<string, NodeJS.Timeout> = new Map();

    constructor(private client: EvolsClient) {}

    watchFolder(folder: string) {
        // Watch knowledge/ folder
        const knowledgeWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, 'knowledge/**/*.md')
        );

        knowledgeWatcher.onDidChange((uri) => this.queueSync(uri));
        knowledgeWatcher.onDidCreate((uri) => this.queueSync(uri));
        knowledgeWatcher.onDidDelete((uri) => this.syncDelete(uri));

        // Watch memory/ folder
        const memoryWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, 'memory/**/*.md')
        );

        memoryWatcher.onDidChange((uri) => this.queueSync(uri));
        memoryWatcher.onDidCreate((uri) => this.queueSync(uri));
        memoryWatcher.onDidDelete((uri) => this.syncDelete(uri));

        this.watchers.push(knowledgeWatcher, memoryWatcher);
    }

    private queueSync(uri: vscode.Uri) {
        // Debounce: wait 2 seconds after last change before syncing
        const path = uri.fsPath;

        if (this.syncQueue.has(path)) {
            clearTimeout(this.syncQueue.get(path)!);
        }

        const timeout = setTimeout(async () => {
            await this.syncFile(uri);
            this.syncQueue.delete(path);
        }, 2000);

        this.syncQueue.set(path, timeout);
    }

    private async syncFile(uri: vscode.Uri) {
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const relativePath = this.getRelativePath(uri);

            await this.client.syncFile({
                path: relativePath,
                content: Buffer.from(content).toString('utf8'),
                timestamp: new Date().toISOString()
            });

            console.log(`Synced: ${relativePath}`);

            // Show subtle notification
            vscode.window.setStatusBarMessage(
                `$(cloud-upload) Synced: ${relativePath}`,
                3000
            );
        } catch (err) {
            console.error('Sync failed:', err);
            vscode.window.showErrorMessage(
                `Failed to sync ${uri.fsPath}: ${err.message}`
            );
        }
    }

    private async syncDelete(uri: vscode.Uri) {
        const relativePath = this.getRelativePath(uri);
        await this.client.deleteFile(relativePath);
        console.log(`Deleted: ${relativePath}`);
    }

    private getRelativePath(uri: vscode.Uri): string {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return uri.fsPath;

        return uri.fsPath.replace(workspace.uri.fsPath + '/', '');
    }

    dispose() {
        this.watchers.forEach(w => w.dispose());
    }
}
```

#### Skills Sidebar Provider

**File:** `vscode-extension/src/skillsProvider.ts`

```typescript
import * as vscode from 'vscode';
import { EvolsClient } from './client';

interface Skill {
    id: number;
    name: string;
    description: string;
    category: string;
    icon: string;
}

export class SkillsProvider implements vscode.TreeDataProvider<SkillTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SkillTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private skills: Skill[] = [];

    constructor(private client: EvolsClient) {
        this.loadSkills();
    }

    refresh(): void {
        this.loadSkills();
        this._onDidChangeTreeData.fire(undefined);
    }

    private async loadSkills() {
        try {
            this.skills = await this.client.getSkills();
        } catch (err) {
            console.error('Failed to load skills:', err);
            vscode.window.showErrorMessage('Failed to load Evols skills');
        }
    }

    getTreeItem(element: SkillTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SkillTreeItem): Promise<SkillTreeItem[]> {
        if (!element) {
            // Root level - show categories
            const categories = [...new Set(this.skills.map(s => s.category))];
            return categories.map(cat => new CategoryTreeItem(cat));
        } else if (element instanceof CategoryTreeItem) {
            // Category level - show skills in category
            const categorySkills = this.skills.filter(s => s.category === element.label);
            return categorySkills.map(skill => new SkillTreeItem(skill));
        }
        return [];
    }
}

class CategoryTreeItem extends vscode.TreeItem {
    constructor(public readonly label: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'category';
    }
}

class SkillTreeItem extends vscode.TreeItem {
    constructor(public readonly skill: Skill) {
        super(skill.name, vscode.TreeItemCollapsibleState.None);
        this.description = skill.description.substring(0, 50) + '...';
        this.tooltip = skill.description;
        this.command = {
            command: 'evols.runSkill',
            title: 'Run Skill',
            arguments: [skill.id]
        };
        this.contextValue = 'skill';
        this.iconPath = new vscode.ThemeIcon('sparkle');
    }
}
```

#### API Client

**File:** `vscode-extension/src/client.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

interface ChatRequest {
    skill_id: number;
    message: string;
    conversation_id?: string;
}

interface FileSync {
    path: string;
    content: string;
    timestamp: string;
}

export class EvolsClient {
    private api: AxiosInstance;
    private token?: string;

    constructor(private baseUrl: string, token?: string) {
        this.token = token;
        this.api = axios.create({
            baseURL: baseUrl,
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
    }

    async signIn(email: string, password: string): Promise<string> {
        const response = await this.api.post('/auth/login', { email, password });
        this.token = response.data.access_token;
        this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
        return this.token;
    }

    async getToken(): Promise<string> {
        if (!this.token) throw new Error('Not authenticated');
        return this.token;
    }

    async getSkills(): Promise<any[]> {
        const response = await this.api.get('/copilot/skills');
        return response.data;
    }

    async chat(request: ChatRequest): Promise<any> {
        const response = await this.api.post('/copilot/chat', request);
        return response.data;
    }

    async syncFile(file: FileSync): Promise<void> {
        await this.api.post('/sync/files', file);
    }

    async deleteFile(path: string): Promise<void> {
        await this.api.delete(`/sync/files/${encodeURIComponent(path)}`);
    }

    async getSuggestedSkills(text: string): Promise<any[]> {
        const response = await this.api.post('/copilot/suggest-skills', { text });
        return response.data.skills;
    }
}
```

---

### 2. Backend Additions (NEW - 1 week)

#### WebSocket Sync Endpoint

**File:** `app/api/v1/endpoints/sync.py` (NEW)

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List
import json
from datetime import datetime

from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_user_from_token
from app.models.user import User
from app.models.file import TenantFile
from pydantic import BaseModel

router = APIRouter()

# Active WebSocket connections: {tenant_id: [websocket1, websocket2, ...]}
active_connections: Dict[int, List[WebSocket]] = {}


class FileSyncRequest(BaseModel):
    path: str
    content: str
    timestamp: str


@router.websocket("/ws")
async def websocket_sync(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """WebSocket endpoint for real-time file sync"""
    await websocket.accept()

    try:
        # Authenticate user from token
        user = await get_current_user_from_token(token, db)
        tenant_id = user.tenant_id

        # Add connection to tenant's pool
        if tenant_id not in active_connections:
            active_connections[tenant_id] = []
        active_connections[tenant_id].append(websocket)

        print(f"User {user.email} connected to sync (tenant {tenant_id})")

        # Keep connection alive
        while True:
            # Receive heartbeat or messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")

    except WebSocketDisconnect:
        # Remove connection
        if tenant_id in active_connections:
            active_connections[tenant_id].remove(websocket)
            if not active_connections[tenant_id]:
                del active_connections[tenant_id]
        print(f"User {user.email} disconnected from sync")

    except Exception as e:
        print(f"WebSocket error: {e}")
        if tenant_id in active_connections and websocket in active_connections[tenant_id]:
            active_connections[tenant_id].remove(websocket)


@router.post("/files")
async def sync_file(
    file: FileSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync file from VS Code extension to backend"""
    from sqlalchemy import select, update

    # Check if file exists
    result = await db.execute(
        select(TenantFile).where(
            TenantFile.tenant_id == current_user.tenant_id,
            TenantFile.file_path == file.path
        )
    )
    existing_file = result.scalars().first()

    if existing_file:
        # Update existing file
        existing_file.content = file.content
        existing_file.version += 1
        existing_file.updated_by_user_id = current_user.id
        existing_file.updated_at = datetime.utcnow()
    else:
        # Create new file
        new_file = TenantFile(
            tenant_id=current_user.tenant_id,
            file_path=file.path,
            content=file.content,
            version=1,
            updated_by_user_id=current_user.id
        )
        db.add(new_file)

    await db.commit()

    # Broadcast to other users in same tenant
    await broadcast_to_tenant(
        tenant_id=current_user.tenant_id,
        message={
            'type': 'file_changed',
            'path': file.path,
            'content': file.content,
            'user': current_user.email,
            'timestamp': datetime.utcnow().isoformat()
        },
        exclude_user_id=current_user.id
    )

    return {"status": "synced", "version": existing_file.version if existing_file else 1}


@router.delete("/files/{file_path:path}")
async def delete_file(
    file_path: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete synced file"""
    from sqlalchemy import delete

    await db.execute(
        delete(TenantFile).where(
            TenantFile.tenant_id == current_user.tenant_id,
            TenantFile.file_path == file_path
        )
    )
    await db.commit()

    # Broadcast deletion
    await broadcast_to_tenant(
        tenant_id=current_user.tenant_id,
        message={
            'type': 'file_deleted',
            'path': file_path,
            'user': current_user.email,
            'timestamp': datetime.utcnow().isoformat()
        },
        exclude_user_id=current_user.id
    )

    return {"status": "deleted"}


@router.get("/files")
async def list_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all synced files for tenant"""
    from sqlalchemy import select

    result = await db.execute(
        select(TenantFile).where(
            TenantFile.tenant_id == current_user.tenant_id
        ).order_by(TenantFile.updated_at.desc())
    )
    files = result.scalars().all()

    return {
        "files": [
            {
                "path": f.file_path,
                "version": f.version,
                "updated_at": f.updated_at.isoformat(),
                "updated_by": f.updated_by_user_id
            }
            for f in files
        ]
    }


async def broadcast_to_tenant(
    tenant_id: int,
    message: dict,
    exclude_user_id: int = None
):
    """Broadcast message to all connected users in tenant"""
    if tenant_id not in active_connections:
        return

    message_str = json.dumps(message)

    # Send to all connections (could filter by user_id if needed)
    for websocket in active_connections[tenant_id]:
        try:
            await websocket.send_text(message_str)
        except Exception as e:
            print(f"Failed to send to websocket: {e}")
```

#### File Storage Model

**File:** `app/models/file.py` (NEW)

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from datetime import datetime
from app.models.base import BaseModel


class TenantFile(BaseModel):
    """
    Stores synced files from VS Code extension.
    These are knowledge/ and memory/ markdown files.
    """
    __tablename__ = 'tenant_files'

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey('products.id', ondelete='CASCADE'), nullable=True, index=True)

    file_path = Column(String(500), nullable=False)  # "knowledge/acme-corp/strategy.md"
    content = Column(Text, nullable=False)
    version = Column(Integer, default=1)

    updated_by_user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<TenantFile(path='{self.file_path}', version={self.version})>"
```

#### Database Migration

**File:** `alembic/versions/xxxx_add_tenant_files.py`

```python
"""Add tenant_files table for VS Code sync

Revision ID: xxxx
Revises: previous_revision
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        'tenant_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('updated_by_user_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index('ix_tenant_files_tenant_id', 'tenant_files', ['tenant_id'])
    op.create_index('ix_tenant_files_product_id', 'tenant_files', ['product_id'])
    op.create_index('ix_tenant_files_path', 'tenant_files', ['tenant_id', 'file_path'])


def downgrade():
    op.drop_index('ix_tenant_files_path')
    op.drop_index('ix_tenant_files_product_id')
    op.drop_index('ix_tenant_files_tenant_id')
    op.drop_table('tenant_files')
```

---

### 3. Integration with unified-pm-os (REQUIRED - 4 weeks)

**CRITICAL CLARIFICATION:**

The unified-pm-os backend integration is **REQUIRED regardless of which frontend you build.**

```
Backend Work (unified-pm-os integration):
├── Load skills from SKILL.md files      (~100 lines)
├── Knowledge layer (product_knowledge)  (~200 lines)
├── Memory system (skill_memory)         (~150 lines)
├── Enhanced system prompts              (~100 lines)
└── Total: ~550 lines + 2 new tables

This work is THE SAME whether you:
- Option A: Only have web UI
- Option B: Only have VS Code extension
- Option C: Have both (recommended)
```

**Frontend Options:**

```
Option A: Web UI Only
├── Backend: unified-pm-os integration (4 weeks)
├── Frontend: Enhance web UI (1 week)
└── Total: 5 weeks

Option B: VS Code Extension Only
├── Backend: unified-pm-os integration (4 weeks)
├── Frontend: Build extension (3 weeks)
└── Total: 7 weeks

Option C: Both Frontends (RECOMMENDED)
├── Backend: unified-pm-os integration (4 weeks)
├── Frontend: Web UI enhancement (1 week)
├── Frontend: VS Code extension (3 weeks)
└── Total: 8 weeks (can parallelize)
```

**Why both frontends:**
- Technical PMs prefer VS Code extension
- Non-technical PMs prefer web UI
- Same backend serves both
- Covers more market segments

---

## Comparison Matrix

### vs Cline

| Feature | Cline | Evols Extension |
|---------|-------|-----------------|
| **Setup** | Install MCP servers manually for each data source | One-click install, sign in |
| **Data Access** | Configure MCP for each DB/API | Automatic via Evols backend |
| **Team Sync** | Git commit/push/pull (manual) | Auto-sync like Google Docs |
| **Merge Conflicts** | Manual git resolution | Visual diff + click to merge |
| **Authentication** | No multi-user auth | Multi-tenant with proper auth |
| **Skills** | Load from local SKILL.md files | Load from Evols (centrally managed) |
| **Tool Registry** | No shared tools, configure each | Evols tool registry (20+ tools) |
| **Updates** | Git pull to get new skills | Auto-update extension from marketplace |
| **Cost** | Free (just LLM costs) | $50-200/user/month |

**Positioning:** "Evols Extension = Cline's great IDE UX + zero setup + team collaboration"

---

### vs Web Evols UI

| Feature | Web UI | VS Code Extension |
|---------|--------|-------------------|
| **File Editing** | Web editor (limited) | Full VS Code power (intellisense, git, etc.) |
| **Keyboard Shortcuts** | Limited | Full VS Code shortcuts |
| **Local Files** | Upload/download | Native filesystem access |
| **Performance** | Network round-trips | Local editing + background sync |
| **Developer Experience** | Separate tool, context switch | Integrated in IDE workflow |
| **Target Audience** | Non-technical PMs | Technical PMs |
| **Barrier to Entry** | Lower (just need browser) | Higher (need VS Code) |

**Positioning:** "Choose your interface - both sync to same backend"

---

## Why I Said "Easier"

**I was comparing the wrong things.** Let me clarify:

### What I MEANT to Say:

"Building VS Code extension is easier than building a completely custom IDE experience"

### What I SHOULD Have Said:

"You need unified-pm-os backend integration REGARDLESS of frontend choice"

### The CORRECT Work Breakdown:

```
TOTAL WORK = Backend Integration + Frontend Choice

Backend (REQUIRED):
├── unified-pm-os integration: 4 weeks
└── This is needed for web UI OR extension OR both

Frontend (CHOOSE):
├── Option A: Just enhance web UI: +1 week
├── Option B: Just build extension: +3 weeks
└── Option C: Both frontends: +4 weeks

Therefore:
- Web UI only: 5 weeks total
- Extension only: 7 weeks total
- Both: 8 weeks total
```

**I was wrong to say extension is "easier" - it's actually MORE work.**

**But it might be MORE VALUABLE because:**
- Differentiates from Cline (zero setup)
- Serves technical PM market better
- Covers both technical + non-technical audiences (if you build both)

---

## Recommended Implementation Order

### Phase 1: Validate Hypothesis (Week 1)

```bash
GOAL: Prove unified-pm-os frameworks solve "skills too generic" problem

1. Use Cline + unified-pm-os yourself
2. Test 5-10 framework skills
3. Compare output to current Evols skills
4. Ask: "Would this solve our users' complaints?"

Decision Point:
- If YES: Proceed to Phase 2
- If NO: Don't integrate - frameworks aren't the answer
```

---

### Phase 2: Backend Integration (Week 2-5)

```bash
GOAL: Integrate unified-pm-os into Evols backend

Week 2: Skills from Files
├── Add file_path column to skills table
├── Create SkillAdapter class
├── Modify load_skill_config() to try file first
└── Test: One skill loads from SKILL.md

Week 3: Knowledge Layer
├── Create product_knowledge table
├── Create knowledge management API endpoints
├── Build KnowledgeManager service
└── Test: System prompts include product knowledge

Week 4: Memory System
├── Create skill_memory table
├── Create MemoryManager service
├── Save skill outputs to memory
└── Test: System prompts reference past work

Week 5: Polish & Testing
├── Register all 83 skills in database
├── Test 10 skills end-to-end
├── Fix bugs
└── Ready for frontend

Decision Point:
- Backend is now ready to serve ANY frontend
- Choose: Web UI, Extension, or Both
```

---

### Phase 3A: Web UI Enhancement (Week 6) - OPTIONAL

```bash
GOAL: Make unified-pm-os skills available in web UI

- Add category filter to advisers page (~26 lines)
- Create knowledge page for strategy docs (~130 lines)
- Create memory page for insights (~150 lines)
- Total: ~300 lines frontend code

Result: Web UI users can access 83 skills + knowledge + memory
```

---

### Phase 3B: VS Code Extension (Week 6-8) - OPTIONAL

```bash
GOAL: Provide IDE-native experience for technical users

Week 6: Extension MVP
├── Basic authentication
├── Skills sidebar
├── Run skill → chat panel
└── Execute skills on backend

Week 7: File Sync
├── Watch local files (knowledge/, memory/)
├── POST to backend on change
├── WebSocket for real-time updates
└── Notification when teammate edits

Week 8: Polish
├── Conflict resolution UI
├── Inline skill suggestions
├── Settings panel
└── Publish to marketplace

Result: Technical PMs can use Evols from VS Code
```

---

### Phase 4: Launch & Iterate (Week 9+)

```bash
Ship both frontends (if built):
- Web UI at app.evols.com
- Extension at VS Code marketplace

Monitor:
- Which frontend gets more usage?
- Do technical users prefer extension?
- Are skills actually used more now?

Iterate based on data.
```

---

## Strategic Recommendations

### My Honest Opinion

**Build both frontends, but prioritize based on your market:**

**If your target market is:**

**Technical PM teams at startups/tech companies:**
```
Priority: VS Code Extension
Why: They live in IDEs, prefer developer tools
Timeline: 7 weeks (backend + extension)
```

**Non-technical PM teams at traditional companies:**
```
Priority: Web UI
Why: IDE is a barrier, web is familiar
Timeline: 5 weeks (backend + web UI)
```

**Both audiences (maximize market):**
```
Priority: Both frontends
Why: Serve entire market, same backend
Timeline: 8 weeks (backend + both frontends)
Risk: Longer time to market, but covers both segments
```

---

### The Differentiation Story

**Against Cline:**
```
"Cline requires MCP server setup for each data source.
Evols Extension: sign in once, everything just works.
Plus real-time team collaboration without git conflicts."
```

**Against Web Tools (ProductBoard, Dovetail):**
```
"Traditional PM tools make you leave your IDE.
Evols Extension: stay in VS Code, AI skills integrated
in your workflow, not a separate app."
```

**Value Proposition:**
```
For Technical PMs:
"The power of AI PM frameworks, integrated into VS Code,
with zero setup and automatic team sync"

For Non-Technical PMs:
"Web-based PM assistant with 83 expert frameworks
and collaborative workspace"
```

---

## Feasibility Summary

### Extension Difficulty: **Medium**

**Easy parts (80%):**
- ✅ VS Code API is well-documented
- ✅ TypeScript/JavaScript (common skills)
- ✅ Backend already exists
- ✅ WebSocket libraries mature

**Challenging parts (20%):**
- ⚠️ Conflict resolution UX (need good design)
- ⚠️ WebSocket connection management (reconnect logic)
- ⚠️ File sync race conditions (debouncing, queuing)

**Overall:** Doable for any experienced full-stack dev

---

### Timeline Confidence

```
Backend integration: 4 weeks     (HIGH confidence)
Web UI enhancement: 1 week       (HIGH confidence)
VS Code extension: 3 weeks       (MEDIUM confidence)

Total (both frontends): 8 weeks  (MEDIUM confidence)

Risk factors:
- WebSocket stability issues
- Merge conflict UX complexity
- User testing reveals issues
- Add 20% buffer: 10 weeks realistic
```

---

## Conclusion

**The VS Code Extension strategy is sound IF:**

1. ✅ Your target market includes technical PMs
2. ✅ You want to differentiate from Cline
3. ✅ You can invest 7-8 weeks
4. ✅ You're willing to support two frontends

**It's NOT easier than web-only (I was wrong), but it's MORE STRATEGIC because:**
- Covers both technical and non-technical audiences
- Differentiation from Cline is clear
- Better UX for developer-focused PMs
- Same backend investment serves both

**Recommendation:**
```
Week 1: Validate with Cline
Week 2-5: Backend integration (unified-pm-os)
Week 6: Web UI enhancement
Week 7-8: VS Code extension
Week 9: Launch both, measure usage

Then optimize based on which frontend your users prefer.
```

---

## Next Steps

**Immediate:**
1. Validate unified-pm-os frameworks work (use Cline this week)
2. Decide: Web UI only, Extension only, or Both?
3. Commit to timeline

**If proceeding with extension:**
1. Set up VS Code extension project structure
2. Implement backend WebSocket endpoint
3. Build MVP: auth + skills sidebar + skill execution
4. Beta test with your team
5. Iterate based on feedback

---

## Files to Create Next

If you want to proceed, I can create:

1. `vscode-extension/package.json` - Extension manifest
2. `vscode-extension/src/extension.ts` - Full implementation
3. `app/api/v1/endpoints/sync.py` - Backend WebSocket endpoint
4. `app/models/file.py` - File storage model
5. `alembic/versions/xxxx_add_tenant_files.py` - Database migration

Let me know which pieces you want fleshed out next.
