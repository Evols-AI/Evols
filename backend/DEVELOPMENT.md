# Development Guide

Quick reference for running ProductOS in development mode.

---

## Quick Start (Without Celery)

**For the simplest local development setup**, disable Celery to avoid running Redis/Celery infrastructure:

```bash
# 1. Add to backend/.env
USE_CELERY=False

# 2. Start the API (no Redis or Celery worker needed!)
cd backend
uvicorn app.main:app --reload

# That's it! Background tasks will run via asyncio.create_task()
```

### Trade-offs of Dev Mode (`USE_CELERY=False`)

**✅ Pros:**
- Simpler setup (no Redis, no Celery worker)
- Faster iteration (fewer moving parts)
- Good for frontend development and API testing

**❌ Cons:**
- Tasks are lost on server restart (non-durable)
- No task retry on failure
- No monitoring UI (Flower)
- Not representative of production

---

## Production Mode (With Celery)

**For production-like testing** or when you need durable background tasks:

```bash
# 1. Add to backend/.env
USE_CELERY=True
REDIS_URL=redis://localhost:6379/0

# 2. Start Redis
docker-compose -f docker-compose.celery.yml up -d redis

# 3. Start Celery worker
celery -A app.core.celery_app worker --loglevel=info --concurrency=4

# 4. Start the API
uvicorn app.main:app --reload

# Optional: Start Flower (monitoring UI)
celery -A app.core.celery_app flower --port=5555
# Visit: http://localhost:5555
```

### Benefits of Production Mode

- ✅ Tasks survive server restarts
- ✅ Auto-retry on failure (3 attempts with backoff)
- ✅ Monitoring via Flower UI
- ✅ Horizontal scaling (run multiple workers)
- ✅ Matches production environment

---

## Switching Between Modes

Just change the environment variable:

```bash
# Development mode (no infrastructure)
USE_CELERY=False

# Production mode (durable tasks)
USE_CELERY=True
```

**No code changes needed.** The system automatically detects the setting and routes tasks accordingly.

---

## When to Use Each Mode

### Use Dev Mode (`USE_CELERY=False`) when:
- Building frontend features
- Testing API endpoints
- Quick prototyping
- You don't need task durability

### Use Production Mode (`USE_CELERY=True`) when:
- Testing background job failures
- Testing server restart scenarios
- Load testing with concurrent tasks
- Preparing for deployment
- Debugging task retry logic

---

## Environment Variables Reference

```bash
# Backend/.env

# Task Queue Configuration
USE_CELERY=True                          # Enable Celery (default: True)
REDIS_URL=redis://localhost:6379/0      # Redis connection (only needed if USE_CELERY=True)

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/productos

# LLM Configuration (required for AI features)
OPENAI_API_KEY=sk-...
# OR
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Azure OpenAI
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://....openai.azure.com/
```

---

## Troubleshooting

### "Connection refused" errors when USE_CELERY=True

**Cause:** Redis is not running or REDIS_URL is incorrect.

**Fix:**
```bash
# Check if Redis is running
redis-cli ping  # Should return "PONG"

# Start Redis if needed
docker-compose -f docker-compose.celery.yml up -d redis
```

### Tasks not completing in dev mode

**Cause:** Using `USE_CELERY=False` means tasks are non-durable. If the server crashes or restarts, tasks are lost.

**Fix:** Use `USE_CELERY=True` for durable tasks, or keep server running while tasks execute.

### Import errors for Celery tasks

**Cause:** Celery dependencies not installed.

**Fix:**
```bash
# Install Celery (use quotes for zsh)
pip install 'celery[redis]==5.3.6' redis==5.0.1

# Or install all deps
pip install -r requirements.txt
```

---

## See Also

- [ENGINEERING_GAPS_MIGRATION.md](../docs/ENGINEERING_GAPS_MIGRATION.md) - Full migration guide
- [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) - Common issues and solutions
- [README.md](../README.md) - Project overview and setup
