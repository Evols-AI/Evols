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
- ✅ `/settings` - User settings (appearance, LLM config)
- ✅ API endpoints for all admin operations

**Not Yet Implemented:**
- ❌ Admin dashboard UI for SUPER_ADMIN
- ❌ Tenant management UI
- ❌ User management UI for TENANT_ADMIN

**Current Workaround:**
All admin operations must be done via API endpoints or create admin UI pages.

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

# 4. Login and use platform
http://localhost:3000/login
```

---

That's it! You now have a fully functional multi-tenant platform with proper role-based access control.
