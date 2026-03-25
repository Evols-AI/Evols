# Evols Setup Guide - From Fresh Database to Multi-Tenant Platform

This guide walks you through setting up Evols from scratch with clear step-by-step instructions.

---

## ✅ Step 1: Create SUPER_ADMIN (Platform Administrator)

The SUPER_ADMIN is the platform-level administrator who can create and manage all tenants.

### Option A: Web UI (Recommended)

1. **Navigate to admin setup page:**
   ```
   http://localhost:3000/admin-setup
   ```

2. **Fill in the form:**
   - **Email:** `admin@yourcompany.com`
   - **Full Name:** `Platform Administrator`
   - **Password:** Choose a secure password
   - **Confirm Password:** Same password
   - **Creation Token:** Get this from your backend `.env` file:
     ```bash
     cat backend/.env | grep SUPER_ADMIN_CREATION_TOKEN
     ```

3. **Click "Create SUPER_ADMIN"**
   - You'll be automatically redirected to login
   - This can only be done ONCE

### Option B: API Direct

```bash
# Get the token
TOKEN=$(cat backend/.env | grep SUPER_ADMIN_CREATION_TOKEN | cut -d '=' -f2)

# Create SUPER_ADMIN
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"admin@yourcompany.com\",
    \"password\": \"YourSecurePassword123!\",
    \"full_name\": \"Platform Administrator\",
    \"is_super_admin\": true,
    \"tenant_slug\": \"${TOKEN}\"
  }"
```

### Verify SUPER_ADMIN Creation

```bash
# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"YourPassword"}'

# Save the access_token from response
TOKEN="eyJhbGc..."

# List all tenants (should work for SUPER_ADMIN)
curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:8000/api/v1/admin/tenants
```

**✨ SUPER_ADMIN Capabilities:**
- ✅ View all tenants across the platform
- ✅ Create new tenants
- ✅ Update tenant settings (plan, limits, etc.)
- ✅ Delete tenants
- ✅ Create users in any tenant
- ❌ Does NOT have a tenant (tenant_id = null)
- ❌ Cannot use product features directly (needs to create regular user)

---

## ✅ Step 2: Create First Tenant (Company/Organization)

Tenants are isolated organizations that use your platform. Each tenant has its own data, users, and products.

### Option A: Via API as SUPER_ADMIN

```bash
# Login as SUPER_ADMIN first
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"YourPassword"}' \
  > /tmp/super_token.json

# Extract token
SUPER_TOKEN=$(cat /tmp/super_token.json | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Create tenant
curl -X POST http://localhost:8000/api/v1/admin/tenants \
  -H "Authorization: Bearer ${SUPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "domain": "acme.com",
    "plan_type": "team",
    "max_users": 10,
    "max_storage_gb": 100
  }'
```

### Option B: Via User Self-Registration (Creates Tenant Automatically)

When users register with a **new tenant slug**, a tenant is auto-created:

```bash
# Register user - creates "startup-co" tenant automatically
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "founder@startup.com",
    "password": "SecurePass123!",
    "full_name": "Startup Founder",
    "tenant_slug": "startup-co"
  }'
```

**What happens:**
- ✅ New tenant "startup-co" created
- ✅ First user becomes TENANT_ADMIN automatically
- ✅ Demo Product with sample data is created
- ✅ Sample personas, feedback, themes added

### Verify Tenant Creation

```bash
# As SUPER_ADMIN, list all tenants
curl -H "Authorization: Bearer ${SUPER_TOKEN}" \
  http://localhost:8000/api/v1/admin/tenants

# Response shows all tenants with user counts
[
  {
    "id": 1,
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "domain": "acme.com",
    "is_active": true,
    "is_trial": false,
    "plan_type": "team",
    "max_users": 10,
    "max_storage_gb": 100,
    "user_count": 0,
    "created_at": "2026-03-06T..."
  }
]
```

---

## ✅ Step 3: Create Users in Tenants

### 3A. Create TENANT_ADMIN (as SUPER_ADMIN)

TENANT_ADMIN can manage users within their own tenant.

```bash
# As SUPER_ADMIN, create admin user in tenant
curl -X POST http://localhost:8000/api/v1/admin/tenants/1/users \
  -H "Authorization: Bearer ${SUPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "AdminPass123!",
    "full_name": "Acme Admin",
    "role": "TENANT_ADMIN"
  }'
```

### 3B. Create Regular Users (as TENANT_ADMIN)

```bash
# Login as TENANT_ADMIN
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"AdminPass123!"}' \
  > /tmp/tenant_token.json

TENANT_TOKEN=$(cat /tmp/tenant_token.json | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Create regular user
curl -X POST http://localhost:8000/api/v1/users/ \
  -H "Authorization: Bearer ${TENANT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@acme.com",
    "password": "UserPass123!",
    "full_name": "Acme User",
    "job_title": "Product Manager",
    "role": "USER"
  }'
```

### 3C. Users Join Existing Tenant

Users can join an existing tenant by registering with the tenant's slug:

```bash
# Join existing "acme-corp" tenant
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@acme.com",
    "password": "NewUserPass123!",
    "full_name": "New Acme Employee",
    "tenant_slug": "acme-corp"
  }'
```

**Note:** They join as regular USER (not admin).

### List Users in Tenant

```bash
# As TENANT_ADMIN, list all users in your tenant
curl -H "Authorization: Bearer ${TENANT_TOKEN}" \
  http://localhost:8000/api/v1/users/
```

---

## ✅ Step 4: Configure LLM API Keys

**IMPORTANT:** Before you can use any AI features (workbench, personas, themes, etc.), you must configure your LLM API keys in Settings.

### Why Configure LLM Keys?

Evols uses a **Bring Your Own Keys (BYOK)** model:
- ✅ You control your own LLM costs
- ✅ Keys are encrypted and stored securely per tenant
- ✅ Each tenant configures their own keys
- ✅ No API keys are stored in environment variables

### Supported LLM Providers

Evols supports 4 LLM providers:

1. **OpenAI** - GPT-4, GPT-4o, GPT-3.5-turbo
2. **Anthropic** - Claude 3.5 Sonnet, Claude 3 Opus
3. **Azure OpenAI** - Your deployed models
4. **AWS Bedrock** - Claude, Titan, Llama models

### How to Configure (Web UI)

1. **Login** to your account (as any user - USER, TENANT_ADMIN, etc.)

2. **Go to Settings:**
   ```
   http://localhost:3000/settings
   ```
   Or click your profile icon → Settings

3. **Navigate to "LLM Settings" tab**

4. **Select your provider** and fill in the required fields:

#### Option A: OpenAI

```
Provider: OpenAI
API Key: sk-proj-xxxxxxxxxxxxx
Model: gpt-4o (recommended) or gpt-4-turbo
Embedding Model: text-embedding-3-small
```

**Get API Key:**
- Sign up at https://platform.openai.com/
- Go to https://platform.openai.com/api-keys
- Click "Create new secret key"

#### Option B: Anthropic

```
Provider: Anthropic
API Key: sk-ant-xxxxxxxxxxxxx
Model: claude-3-5-sonnet-20241022 (recommended)
```

**Get API Key:**
- Sign up at https://console.anthropic.com/
- Go to https://console.anthropic.com/settings/keys
- Click "Create Key"

#### Option C: Azure OpenAI

```
Provider: Azure OpenAI
API Key: xxxxxxxxxxxxxxxxxxxxxxxx
Endpoint: https://your-resource.openai.azure.com/
Deployment Name: your-gpt4-deployment
API Version: 2024-02-15-preview
Model: gpt-4
Embedding Model: text-embedding-ada-002
```

**Get Credentials:**
- Create Azure OpenAI resource in Azure Portal
- Deploy models (GPT-4, embeddings)
- Get endpoint and API key from Azure Portal

#### Option D: AWS Bedrock

**API Key Method:**
```
Provider: AWS Bedrock
Auth Method: API Key
AWS Access Key ID: AKIAXXXXXXXXX
AWS Secret Access Key: xxxxxxxxxxxxx
Region: us-east-1
Model: anthropic.claude-3-5-sonnet-20241022-v2:0
```

**Credentials Method:**
```
Provider: AWS Bedrock
Auth Method: AWS Credentials
Region: us-east-1
Model: anthropic.claude-3-5-sonnet-20241022-v2:0
```

**Get Credentials:**
- Enable Bedrock in AWS Console
- Request model access for Claude/Titan
- Create IAM user with Bedrock permissions
- Generate access keys

5. **Click "Test Connection"**
   - Verifies your credentials work
   - Makes a test LLM call
   - Shows success/error message

6. **Click "Save Settings"**
   - Encrypts and stores your keys
   - Keys are now available for all tenant users

### How to Configure (API)

```bash
# Login first
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com","password":"YourPassword"}' \
  > /tmp/token.json

TOKEN=$(cat /tmp/token.json | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

# Configure OpenAI
curl -X POST http://localhost:8000/api/v1/llm-settings \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "sk-proj-xxxxxxxxxxxxx",
    "model": "gpt-4o",
    "embedding_model": "text-embedding-3-small"
  }'

# Test connection
curl -X POST http://localhost:8000/api/v1/llm-settings/test \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "api_key": "sk-proj-xxxxxxxxxxxxx",
    "model": "gpt-4o"
  }'
```

### Verify LLM Configuration

```bash
# Get current LLM settings
curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:8000/api/v1/llm-settings

# Response (API key is masked):
{
  "id": 1,
  "tenant_id": 1,
  "provider": "openai",
  "model": "gpt-4o",
  "embedding_model": "text-embedding-3-small",
  "api_key": "sk-proj-***REDACTED***"
}
```

### Per-Tenant Configuration

- Each tenant configures their own LLM keys independently
- Keys are encrypted with AES-256-GCM
- Keys are isolated per tenant (never shared)
- Any user in the tenant can update LLM settings

### What Happens Without LLM Keys?

Without configured LLM keys:
- ❌ Cannot use Workbench AI copilot
- ❌ Cannot generate personas
- ❌ Cannot cluster feedback into themes
- ❌ Cannot auto-generate initiatives
- ❌ Cannot use any AI-powered features
- ✅ Can still upload feedback, manage users, view data

### Troubleshooting LLM Setup

**Problem: "Test connection failed"**
- Double-check your API key is correct
- Verify you have credits/quota in your provider account
- For Azure: ensure endpoint URL is correct
- For Bedrock: verify model access is approved

**Problem: "Invalid API key format"**
- OpenAI keys start with `sk-proj-` or `sk-`
- Anthropic keys start with `sk-ant-`
- Azure keys are 32 alphanumeric characters
- AWS keys: Access Key starts with `AKIA`

**Problem: "Model not available"**
- OpenAI: Check you have access to GPT-4
- Bedrock: Request model access in AWS Console
- Azure: Verify model is deployed in your resource

### Recommended Models (March 2024)

**For Best Quality:**
- OpenAI: `gpt-4o` or `gpt-4-turbo`
- Anthropic: `claude-3-5-sonnet-20241022`
- Bedrock: `anthropic.claude-3-5-sonnet-20241022-v2:0`

**For Cost Efficiency:**
- OpenAI: `gpt-4o-mini` or `gpt-3.5-turbo`
- Bedrock: `anthropic.claude-3-haiku-20240307-v1:0`

**For Embeddings:**
- OpenAI: `text-embedding-3-small` (recommended)
- Azure: `text-embedding-ada-002`

---

## 📊 Role Comparison Table

| Operation | USER | TENANT_ADMIN | SUPER_ADMIN |
|-----------|------|--------------|-------------|
| View own tenant data | ✅ | ✅ | ❌ (no tenant) |
| Upload feedback, create themes | ✅ | ✅ | ❌ |
| Use personas, workbench, roadmap | ✅ | ✅ | ❌ |
| View users in tenant | Self only | ✅ All | ✅ All tenants |
| Create users in tenant | ❌ | ✅ | ✅ Any tenant |
| Update/delete users | Self only | ✅ Same tenant | ✅ Any tenant |
| View all tenants | ❌ | ❌ | ✅ |
| Create/delete tenants | ❌ | ❌ | ✅ |
| Manage tenant settings | ❌ | ❌ | ✅ |
| Has tenant_id | ✅ | ✅ | ❌ (null) |

---

## 🎛️ Admin UI (Current Status)

**Currently Available:**
- ✅ `/admin-setup` - One-time SUPER_ADMIN creation page
- ✅ `/admin/tenants` - SUPER_ADMIN tenant management (view, create, edit tenants & users)
- ✅ `/admin/support` - SUPER_ADMIN support ticket management
- ✅ `/admin/advisers-platform` - SUPER_ADMIN skills analytics
- ✅ `/settings` - User settings including:
  - **LLM Configuration** (OpenAI, Anthropic, Azure, Bedrock) - **REQUIRED**
  - Appearance (theme, display preferences)
  - Profile management
- ✅ API endpoints for all operations

**Admin UI Features:**
- Full tenant CRUD operations
- User management within tenants
- LLM API key configuration per tenant
- Support ticket tracking

---

## 🔐 User Management Cheat Sheet

### As SUPER_ADMIN

```bash
# List all tenants
GET /api/v1/admin/tenants

# Get tenant details
GET /api/v1/admin/tenants/{tenant_id}

# Update tenant
PUT /api/v1/admin/tenants/{tenant_id}

# Delete tenant (force=true to delete with users)
DELETE /api/v1/admin/tenants/{tenant_id}?force=true

# Create user in any tenant
POST /api/v1/admin/tenants/{tenant_id}/users

# List users in any tenant
GET /api/v1/admin/tenants/{tenant_id}/users
```

### As TENANT_ADMIN

```bash
# List users in own tenant
GET /api/v1/users/

# Create user in own tenant
POST /api/v1/users/

# Get user details
GET /api/v1/users/{user_id}

# Update user
PUT /api/v1/users/{user_id}

# Delete user
DELETE /api/v1/users/{user_id}
```

---

## 📝 Common Workflows

### Workflow 1: Onboard New Company

```bash
# 1. SUPER_ADMIN creates tenant
curl -X POST http://localhost:8000/api/v1/admin/tenants \
  -H "Authorization: Bearer ${SUPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"New Co","slug":"new-co","plan_type":"business","max_users":50}'

# 2. SUPER_ADMIN creates first admin for that tenant
curl -X POST http://localhost:8000/api/v1/admin/tenants/2/users \
  -H "Authorization: Bearer ${SUPER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@newco.com","password":"Pass123!","full_name":"Admin","role":"TENANT_ADMIN"}'

# 3. Give admin@newco.com their credentials
# 4. They login and manage their own users
```

### Workflow 2: User Self-Service

```bash
# 1. User registers (creates new tenant or joins existing)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com","password":"Pass123!","full_name":"User","tenant_slug":"company"}'

# 2. If new tenant: they become TENANT_ADMIN, get Demo Product
# 3. If existing tenant: they become USER
# 4. They login and start using the platform
```

### Workflow 3: Deactivate User

```bash
# As TENANT_ADMIN or SUPER_ADMIN
curl -X PUT http://localhost:8000/api/v1/users/5 \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'
```

---

## 🧪 Testing Your Setup

### Test 1: SUPER_ADMIN Access

```bash
# Login as SUPER_ADMIN
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"YourPassword"}'

# Should return: tenant_id: null, role: "SUPER_ADMIN"
```

### Test 2: Tenant Isolation

```bash
# Login as user from Tenant A
# Try to access data from Tenant B
# Should fail with 403 Forbidden
```

### Test 3: Role Permissions

```bash
# Login as regular USER
# Try to create another user
POST /api/v1/users/
# Should fail with 403 Forbidden

# Login as TENANT_ADMIN
# Try to create user
POST /api/v1/users/
# Should succeed
```

---

## 🆘 Troubleshooting

**Problem: "SUPER_ADMIN creation is not enabled"**
- Check that `SUPER_ADMIN_CREATION_TOKEN` is set in backend `.env`
- Restart backend to pick up environment variables

**Problem: "SUPER_ADMIN already exists"**
- You can only create one SUPER_ADMIN via the creation token
- Additional admins must be created via admin API

**Problem: "This operation requires a tenant context"**
- SUPER_ADMIN users have no tenant
- They cannot access product features directly
- Create a regular user account to use features

**Problem: No demo product created**
- Only happens for NEW tenants (first user registration)
- Existing tenants won't get demo products retroactively

---

## 📚 API Documentation

Full API documentation available at:
```
http://localhost:8000/api/v1/docs
```

Sections:
- **Authentication** - Register, login
- **Admin** - Cross-tenant management (SUPER_ADMIN only)
- **Users** - User management within tenant
- **Products** - Multi-product management
- **Feedback, Themes, Personas, Roadmap, Workbench** - Core features

---

## 🎯 Quick Start Summary

```bash
# 1. Create SUPER_ADMIN (one time only)
Visit: http://localhost:3000/admin-setup

# 2. Create tenant + admin (as SUPER_ADMIN or via self-registration)
# Via API or register at: http://localhost:3000/register

# 3. Create users (as TENANT_ADMIN)
curl -X POST http://localhost:8000/api/v1/users/ ...

# 4. Configure LLM API Keys (REQUIRED for AI features)
Visit: http://localhost:3000/settings → LLM Settings tab
Add your OpenAI/Anthropic/Azure/Bedrock API key

# 5. Login and use platform
http://localhost:3000/login
```

---

That's it! You now have a fully functional multi-tenant platform with proper role-based access control.
