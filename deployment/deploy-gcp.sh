#!/bin/bash
# deploy-gcp.sh — Deploy Evols (backend + frontend + workbench + nginx)
#
# Architecture:
#   evols-nginx (public)  →  evols-frontend  (Next.js, internal)
#                         →  evols-workbench (LibreChat fork, internal)
#
# Prerequisites:
#   1. evols-workbench fork cloned at ../evols-workbench (or set WORKBENCH_DIR)
#   2. MongoDB Atlas cluster connection string
#   3. Evols backend deployed (or deploy in same run)
#
# Usage:
#   export MONGO_URI="mongodb+srv://..."
#   export OIDC_CLIENT_SECRET="..."
#   export AWS_ACCESS_KEY_ID="..."
#   export AWS_SECRET_ACCESS_KEY="..."
#   export EVOLS_DOMAIN="evols.ai"          # omit to use the backend Cloud Run URL
#   export LIGHTRAG_API_KEY="lr_..."        # optional, has default
#   ./deployment/deploy-gcp.sh PROJECT_ID [REGION]

set -euo pipefail

PROJECT_ID=${1:?Usage: ./deployment/deploy-gcp.sh PROJECT_ID [REGION]}
REGION=${2:-us-central1}
REPOSITORY="evols-repo"
IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
EVOLS_DOMAIN="${EVOLS_DOMAIN:-}"
WORKBENCH_DIR="${WORKBENCH_DIR:-../evols-workbench}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# ── Required secrets ──────────────────────────────────────────────────────────
MONGO_URI="${MONGO_URI:?Set MONGO_URI}"
OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:?Set OIDC_CLIENT_SECRET}"
LIGHTRAG_API_KEY="${LIGHTRAG_API_KEY:-lr_6c7e3b0a348fe6f206cf83cd794a908f751e2f07bee8c997}"
# FIELD_ENCRYPTION_KEY: stable Fernet key stored in Secret Manager. Falls back to env var.
# First-time setup: python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
# then: gcloud secrets create evols-field-encryption-key --data-file=-
if [ -z "${FIELD_ENCRYPTION_KEY:-}" ]; then
  FIELD_ENCRYPTION_KEY=$(gcloud secrets versions access latest --secret=evols-field-encryption-key --project="${PROJECT_ID}" 2>/dev/null || true)
fi
FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:?FIELD_ENCRYPTION_KEY not set. Create the secret: gcloud secrets create evols-field-encryption-key --data-file=- <<< your_fernet_key}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}"
CREDS_KEY="${CREDS_KEY:-$(openssl rand -hex 32)}"
CREDS_IV="${CREDS_IV:-$(openssl rand -hex 16)}"
OPENID_SESSION_SECRET="${OPENID_SESSION_SECRET:-$(openssl rand -hex 32)}"

store_secret() {
  local name="$1" value="$2"
  if gcloud secrets describe "${name}" --project="${PROJECT_ID}" &>/dev/null; then
    printf '%s' "${value}" | gcloud secrets versions add "${name}" \
      --project="${PROJECT_ID}" --data-file=-
  else
    printf '%s' "${value}" | gcloud secrets create "${name}" \
      --project="${PROJECT_ID}" --data-file=- --replication-policy=automatic
  fi
}

echo "==> Enabling required GCP APIs..."
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com \
  --project "${PROJECT_ID}"

# ── 1. Backend ────────────────────────────────────────────────────────────────
echo "==> Building backend image..."
gcloud builds submit --config=deployment/cloudbuild-backend.yaml \
  --substitutions="_TAG=${IMAGE_PREFIX}/evols-backend:latest" \
  --project "${PROJECT_ID}" .

# PUBLIC_BASE is set here if EVOLS_DOMAIN is known; updated after backend deploy if not
PUBLIC_BASE="${EVOLS_DOMAIN:+https://${EVOLS_DOMAIN}}"

echo "==> Deploying evols-backend..."
SQL_CONNECTION_NAME=$(gcloud sql instances describe evols-postgres \
  --format='value(connectionName)' --project "${PROJECT_ID}")

gcloud run deploy evols-backend \
  --image "${IMAGE_PREFIX}/evols-backend:latest" \
  --region "${REGION}" --platform managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars "DATABASE_URL=postgresql+asyncpg://postgres:postgres123@/evols?host=/cloudsql/${SQL_CONNECTION_NAME}" \
  --set-env-vars "ENVIRONMENT=production" \
  --set-env-vars "REDIS_URL=redis://10.128.0.43:6379/0" \
  --set-env-vars 'BACKEND_CORS_ORIGINS=["*"]' \
  --set-env-vars "TAVILY_API_KEY=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" \
  --set-env-vars "EMBEDDING_PROVIDER=aws_bedrock" \
  --set-env-vars "UNIFIED_PM_OS_PATH=./resources/unified-pm-os" \
  --set-env-vars "FRONTEND_URL=${PUBLIC_BASE}" \
  --set-env-vars "OIDC_ISSUER=${PUBLIC_BASE}/api/v1/oidc" \
  --set-env-vars "OIDC_CLIENT_ID=evols-workbench" \
  --set-env-vars "OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}" \
  --set-env-vars "LIGHTRAG_URL=https://evols-lightrag-446160743186.us-central1.run.app" \
  --set-env-vars "LIGHTRAG_API_KEY=${LIGHTRAG_API_KEY:?Set LIGHTRAG_API_KEY}" \
  --set-env-vars "FIELD_ENCRYPTION_KEY=${FIELD_ENCRYPTION_KEY}" \
  --add-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --network default --subnet default \
  --vpc-egress private-ranges-only \
  --project "${PROJECT_ID}"

BACKEND_URL=$(gcloud run services describe evols-backend \
  --region "${REGION}" --format='value(status.url)' --project "${PROJECT_ID}")
echo "Backend URL: ${BACKEND_URL}"

# Fall back to backend Cloud Run URL if no custom domain was set
PUBLIC_BASE="${PUBLIC_BASE:-${BACKEND_URL}}"

# ── 1b. LightRAG — deploy / update ───────────────────────────────────────────
# WARNING: Never use `gcloud run services update --set-env-vars` for LightRAG — it
# replaces ALL env vars and falls back to Ollama defaults, wiping the config.
# Always redeploy with the full env var set.
# EMBEDDING_TIMEOUT=120 → worker timeout 240s to handle Bedrock cold-start latency.
LIGHTRAG_IMAGE="${LIGHTRAG_IMAGE:-us-central1-docker.pkg.dev/${PROJECT_ID}/evols-repo/evols-lightrag:latest}"
SQL_CONNECTION_NAME="${SQL_CONNECTION_NAME:-$(gcloud sql instances describe evols-postgres --format='value(connectionName)' --project "${PROJECT_ID}")}"
echo "==> Deploying evols-lightrag..."
gcloud run deploy evols-lightrag \
  --image "${LIGHTRAG_IMAGE}" \
  --region "${REGION}" --platform managed \
  --allow-unauthenticated \
  --min-instances=1 \
  --set-env-vars "LIGHTRAG_KV_STORAGE=PGKVStorage" \
  --set-env-vars "LIGHTRAG_VECTOR_STORAGE=PGVectorStorage" \
  --set-env-vars "LIGHTRAG_GRAPH_STORAGE=NetworkXStorage" \
  --set-env-vars "LIGHTRAG_DOC_STATUS_STORAGE=PGDocStatusStorage" \
  --set-env-vars "POSTGRES_HOST=/cloudsql/${SQL_CONNECTION_NAME}" \
  --set-env-vars "POSTGRES_PORT=5432" \
  --set-env-vars "POSTGRES_DATABASE=evols" \
  --set-env-vars "POSTGRES_USER=postgres" \
  --set-env-vars "LLM_BINDING=openai" \
  --set-env-vars "LLM_MODEL=claude-haiku-4-5-20251001" \
  --set-env-vars "LLM_BINDING_HOST=${BACKEND_URL}/api/v1/llm-proxy/bedrock" \
  --set-env-vars "EMBEDDING_BINDING=openai" \
  --set-env-vars "EMBEDDING_MODEL=amazon.titan-embed-text-v2:0" \
  --set-env-vars "EMBEDDING_DIM=1024" \
  --set-env-vars "EMBEDDING_BINDING_HOST=${BACKEND_URL}/api/v1/llm-proxy/bedrock" \
  --set-env-vars "EMBEDDING_TIMEOUT=120" \
  --set-env-vars "MAX_ASYNC=2" \
  --set-env-vars "MAX_TOKENS=32768" \
  --set-env-vars "AUTH_ACCOUNTS=evols:${LIGHTRAG_API_KEY}" \
  --set-env-vars "TOKEN_SECRET=81cedc8e5042e71ccfb779dee55a8480d9e92f76080b1ccd8e34d7356a5b1b02" \
  --set-secrets "POSTGRES_PASSWORD=lightrag-pg-password:latest" \
  --set-secrets "LLM_BINDING_API_KEY=lightrag-api-key:latest" \
  --set-secrets "EMBEDDING_BINDING_API_KEY=lightrag-api-key:latest" \
  --add-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --project "${PROJECT_ID}" || echo "Warning: LightRAG deploy failed (service may not exist yet)"

# ── 2. Frontend ───────────────────────────────────────────────────────────────
echo "==> Building frontend image..."
# Pass empty _API_URL so the bundle uses same-origin routing through nginx.
# An absolute backend URL baked into the bundle bypasses nginx and causes cross-origin
# auth failures when the Cloud Run service URL changes.
gcloud builds submit --config=deployment/cloudbuild-frontend.yaml \
  --substitutions="_TAG=${IMAGE_PREFIX}/evols-frontend:latest,_API_URL=" \
  --project "${PROJECT_ID}" .

echo "==> Deploying evols-frontend..."
gcloud run deploy evols-frontend \
  --image "${IMAGE_PREFIX}/evols-frontend:latest" \
  --region "${REGION}" --platform managed \
  --allow-unauthenticated \
  --ingress=all \
  --project "${PROJECT_ID}"

FRONTEND_URL=$(gcloud run services describe evols-frontend \
  --region "${REGION}" --format='value(status.url)' --project "${PROJECT_ID}")

# ── 3. Workbench (LibreChat fork) ─────────────────────────────────────────────
WORKBENCH_IMAGE="${IMAGE_PREFIX}/evols-workbench:latest"

if [ "${SKIP_BUILD}" = "true" ]; then
  echo "==> Skipping workbench build (SKIP_BUILD=true)"
else
  echo "==> Building evols-workbench image..."
  if [ ! -f "${WORKBENCH_DIR}/package.json" ]; then
    echo "ERROR: evols-workbench not found at ${WORKBENCH_DIR}"
    echo "Clone: git clone https://github.com/Evols-AI/evols-workbench ${WORKBENCH_DIR}"
    exit 1
  fi
  docker build --platform linux/amd64 -t "${WORKBENCH_IMAGE}" "${WORKBENCH_DIR}"
  docker push "${WORKBENCH_IMAGE}"
fi

echo "==> Storing workbench secrets..."
store_secret "workbench-mongo-uri"             "${MONGO_URI}"
store_secret "workbench-oidc-client-secret"    "${OIDC_CLIENT_SECRET}"
store_secret "workbench-jwt-secret"            "${JWT_SECRET}"
store_secret "workbench-jwt-refresh-secret"    "${JWT_REFRESH_SECRET}"
store_secret "workbench-creds-key"             "${CREDS_KEY}"
store_secret "workbench-creds-iv"              "${CREDS_IV}"
store_secret "workbench-openid-session-secret" "${OPENID_SESSION_SECRET}"

echo "==> Deploying evols-workbench..."
gcloud run deploy evols-workbench \
  --image="${WORKBENCH_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --ingress=all \
  --memory=1Gi --cpu=1 \
  --min-instances=0 --max-instances=5 \
  --port=3080 \
  --set-env-vars="NODE_ENV=production,HOST=0.0.0.0,BASE_PATH=/workbench/app,APP_BASE_PATH=/workbench/app,ALLOW_REGISTRATION=false,ALLOW_SOCIAL_LOGIN=true,ALLOW_SOCIAL_REGISTRATION=true,OPENID_ISSUER=${PUBLIC_BASE}/api/v1/oidc,OPENID_CLIENT_ID=evols-workbench,OPENID_SCOPE=openid profile email,OPENID_CALLBACK_URL=/workbench/app/oauth/openid/callback,OPENID_BUTTON_LABEL=Sign in with Evols,EVOLS_BACKEND_URL=${PUBLIC_BASE},DOMAIN_CLIENT=${PUBLIC_BASE}/workbench/app,DOMAIN_SERVER=${PUBLIC_BASE}" \
  --set-secrets="MONGO_URI=workbench-mongo-uri:latest,OPENID_CLIENT_SECRET=workbench-oidc-client-secret:latest,JWT_SECRET=workbench-jwt-secret:latest,JWT_REFRESH_SECRET=workbench-jwt-refresh-secret:latest,CREDS_KEY=workbench-creds-key:latest,CREDS_IV=workbench-creds-iv:latest,OPENID_SESSION_SECRET=workbench-openid-session-secret:latest"

WORKBENCH_URL=$(gcloud run services describe evols-workbench \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo "==> Seeding Evols AI agent into MongoDB..."
MONGO_URI="${MONGO_URI}" node "${WORKBENCH_DIR}/scripts/seed-evols-agent.js"

# ── 4. Nginx (public entry point) ─────────────────────────────────────────────
echo "==> Building evols-nginx image..."
NGINX_IMAGE="${IMAGE_PREFIX}/evols-nginx:latest"
gcloud builds submit --config=deployment/cloudbuild-nginx.yaml \
  --substitutions="_TAG=${NGINX_IMAGE}" \
  --project "${PROJECT_ID}" .

LIBRECHAT_HOST=$(echo "${WORKBENCH_URL}" | sed 's|https://||')
FRONTEND_HOST=$(echo "${FRONTEND_URL}" | sed 's|https://||')
BACKEND_HOST_ONLY=$(echo "${BACKEND_URL}" | sed 's|https://||')

echo "==> Deploying evols-nginx (public)..."
gcloud run deploy evols-nginx \
  --image="${NGINX_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --memory=256Mi --cpu=1 \
  --min-instances=1 --max-instances=10 \
  --port=8080 \
  --set-env-vars="LIBRECHAT_UPSTREAM=${LIBRECHAT_HOST}:443,FRONTEND_UPSTREAM=${FRONTEND_HOST}:443,BACKEND_UPSTREAM=${BACKEND_HOST_ONLY}:443,LIBRECHAT_HOST=${LIBRECHAT_HOST},FRONTEND_HOST=${FRONTEND_HOST},BACKEND_HOST=${BACKEND_HOST_ONLY},PUBLIC_HOST=${EVOLS_DOMAIN:-${BACKEND_HOST_ONLY}}"

NGINX_URL=$(gcloud run services describe evols-nginx \
  --region="${REGION}" --project="${PROJECT_ID}" \
  --format="value(status.url)")

echo ""
echo "==> Deployment complete!"
echo ""
echo "  Nginx (public):       ${NGINX_URL}"
echo "  Frontend (internal):  ${FRONTEND_URL}"
echo "  Workbench (internal): ${WORKBENCH_URL}"
echo "  Backend:              ${BACKEND_URL}"
echo ""
if [ -z "${EVOLS_DOMAIN}" ]; then
  echo "Next steps:"
  echo "  1. Point your domain (e.g. app.evols.ai) to: ${NGINX_URL}"
  echo "  2. Re-run with EVOLS_DOMAIN=app.evols.ai to set the correct OIDC issuer"
fi
