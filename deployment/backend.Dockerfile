FROM python:3.13-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and lockfile — install from lockfile with hash verification.
# requirements.lock is generated via: pip-compile --generate-hashes --allow-unsafe
# To update: run pip-compile locally, commit the new requirements.lock.
COPY backend/requirements.txt backend/requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock

# Copy application code
COPY backend/ .

# Bundle the evols CLI + hooks — served via /api/v1/install/cli
# No platform-specific binaries needed: agents run `evols mcp-server` directly
RUN mkdir -p /app/cli/hooks
COPY cli/evols        /app/cli/evols
COPY cli/hooks/       /app/cli/hooks/

# Run migrations then start the application
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
