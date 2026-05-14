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
#   Secrets are auto-loaded from backend/.env.production.
#   Env vars already exported in the calling shell take precedence.
#   ./deployment/deploy-gcp.sh PROJECT_ID [REGION]

set -euo pipefail

PROJECT_ID=${1:?Usage: ./deployment/deploy-gcp.sh PROJECT_ID [REGION]}
REGION=${2:-us-central1}
REPOSITORY="evols-repo"
IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}"
WORKBENCH_DIR="${WORKBENCH_DIR:-../evols-workbench}"
SKIP_BUILD="${SKIP_BUILD:-false}"

# ── Auto-load backend/.env.production (source of truth for all secrets) ───────
# Env vars already exported in the shell take precedence over the file.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_PROD="${SCRIPT_DIR}/../backend/.env.production"
if [ -f "${ENV_PROD}" ]; then
  echo "==> Loading secrets from backend/.env.production"
  while IFS= read -r line || [ -n "${line}" ]; do
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    if [ -z "${!key+x}" ]; then
      export "${key}=${val}"
    fi
  done < "${ENV_PROD}"
fi

# EVOLS_DOMAIN can be overridden via env but defaults to value in .env.production
EVOLS_DOMAIN="${EVOLS_DOMAIN:-}"

# ── Required secrets ──────────────────────────────────────────────────────────
MONGO_URI="${MONGO_URI:?Set MONGO_URI in backend/.env.production}"
OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:?Set OIDC_CLIENT_SECRET in backend/.env.production}"
SMTP_HOST="${SMTP_HOST:-smtp.zoho.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-info@evols.ai}"
SMTP_PASSWORD="${SMTP_PASSWORD:?Set SMTP_PASSWORD in backend/.env.production}"
EMAIL_FROM="${EMAIL_FROM:-info@evols.ai}"
LIGHTRAG_API_KEY="${LIGHTRAG_API_KEY:-lr_6c7e3b0a348fe6f206cf83cd794a908f751e2f07bee8c997}"
# FIELD_ENCRYPTION_KEY: stable Fernet key stored in Secret Manager. Falls back to env var.
# First-time setup: python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
# then: gcloud secrets create evols-field-encryption-key --data-file=-
if [ -z "${FIELD_ENCRYPTION_KEY:-}" ]; then
  FIELD_ENCRYPTION_KEY=$(gcloud secrets versions access latest --secret=evols-field-encryption-key --project="${PROJECT_ID}" 2>/dev/null || true)
fi
FIELD_ENCRYPTION_KEY="${FIELD_ENCRYPTION_KEY:?FIELD_ENCRYPTION_KEY not set. Create the secret: gcloud secrets create evols-field-encryption-key --data-file=- <<< your_fernet_key}"

# ENCRYPTION_MASTER_SECRET: AES-256-GCM master key for content-at-rest encryption (retention policies).
# First-time setup: python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
# then: gcloud secrets create evols-encryption-master-secret --data-file=-
if [ -z "${ENCRYPTION_MASTER_SECRET:-}" ]; then
  ENCRYPTION_MASTER_SECRET=$(gcloud secrets versions access latest --secret=evols-encryption-master-secret --project="${PROJECT_ID}" 2>/dev/null || true)
fi
ENCRYPTION_MASTER_SECRET="${ENCRYPTION_MASTER_SECRET:?ENCRYPTION_MASTER_SECRET not set. Create the secret: python3 -c 'import secrets; print(secrets.token_urlsafe(32))' | gcloud secrets create evols-encryption-master-secret --data-file=-}"
# Stable workbench secrets — read from .env.production so redeployments reuse the same values.
# Falls back to generating new randoms only on first deploy (before the file has them).
JWT_SECRET="${WORKBENCH_JWT_SECRET:-${JWT_SECRET:-$(openssl rand -hex 32)}}"
JWT_REFRESH_SECRET="${WORKBENCH_JWT_REFRESH_SECRET:-${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}}"
CREDS_KEY="${WORKBENCH_CREDS_KEY:-${CREDS_KEY:-$(openssl rand -hex 32)}}"
CREDS_IV="${WORKBENCH_CREDS_IV:-${CREDS_IV:-$(openssl rand -hex 16)}}"
OPENID_SESSION_SECRET="${WORKBENCH_OPENID_SESSION_SECRET:-${OPENID_SESSION_SECRET:-$(openssl rand -hex 32)}}"

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

echo "==> Storing secrets in Secret Manager..."
store_secret "evols-smtp-password"   "${SMTP_PASSWORD}"
store_secret "evols-lightrag-api-key" "${LIGHTRAG_API_KEY}"

# Pre-clean any vars that were previously plain strings but are now secrets.
# Cloud Run refuses to change a var's type in a single update — clearing them first
# prevents new revisions from being created then immediately retired.
echo "==> Pre-cleaning legacy plain-text vars that are now secrets..."
gcloud run services update evols-backend \
  --region "${REGION}" --platform managed \
  --remove-env-vars "SMTP_PASSWORD,LIGHTRAG_API_KEY,OIDC_ISSUER,OIDC_CLIENT_ID,OIDC_CLIENT_SECRET" \
  --project "${PROJECT_ID}" 2>/dev/null || true

echo "==> Deploying evols-backend..."
SQL_CONNECTION_NAME=$(gcloud sql instances describe evols-postgres \
  --format='value(connectionName)' --project "${PROJECT_ID}")

gcloud run deploy evols-backend \
  --image "${IMAGE_PREFIX}/evols-backend:latest" \
  --region "${REGION}" --platform managed \
  --allow-unauthenticated \
  --memory=2Gi \
  --min-instances=1 \
  --set-env-vars "DATABASE_URL=postgresql+asyncpg://postgres:postgres123@/evols?host=/cloudsql/${SQL_CONNECTION_NAME}" \
  --set-env-vars "ENVIRONMENT=production" \
  --set-env-vars "REDIS_URL=redis://10.128.0.43:6379/0" \
  --set-env-vars 'BACKEND_CORS_ORIGINS=["*"]' \
  --set-env-vars "SMTP_HOST=${SMTP_HOST}" \
  --set-env-vars "SMTP_PORT=${SMTP_PORT}" \
  --set-env-vars "SMTP_USER=${SMTP_USER}" \
  --set-env-vars "EMAIL_FROM=${EMAIL_FROM}" \
  --set-env-vars "TAVILY_API_KEY=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" \
  --set-env-vars "EMBEDDING_PROVIDER=aws_bedrock" \
  --set-env-vars "UNIFIED_PM_OS_PATH=./resources/unified-pm-os" \
  --set-env-vars "FRONTEND_URL=${PUBLIC_BASE}" \
  --set-env-vars "OIDC_ISSUER=SET_AFTER_BACKEND_DEPLOY" \
  --set-env-vars "OIDC_CLIENT_ID=evols-workbench" \
  --set-env-vars "OIDC_CLIENT_SECRET=${OIDC_CLIENT_SECRET}" \
  --set-env-vars "LIGHTRAG_URL=https://evols-lightrag-kdqer5oyua-uc.a.run.app" \
  --set-env-vars "LIGHTRAG_TOKEN_SECRET=81cedc8e5042e71ccfb779dee55a8480d9e92f76080b1ccd8e34d7356a5b1b02" \
  --set-secrets "SMTP_PASSWORD=evols-smtp-password:latest,LIGHTRAG_API_KEY=evols-lightrag-api-key:latest,FIELD_ENCRYPTION_KEY=evols-field-encryption-key:latest,ENCRYPTION_MASTER_SECRET=evols-encryption-master-secret:latest,AWS_ACCESS_KEY_ID=evols-aws-access-key-id:latest,AWS_SECRET_ACCESS_KEY=evols-aws-secret-access-key:latest" \
  --add-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --network default --subnet default \
  --vpc-egress private-ranges-only \
  --project "${PROJECT_ID}"

BACKEND_URL=$(gcloud run services describe evols-backend \
  --region "${REGION}" --format='value(status.url)' --project "${PROJECT_ID}")
echo "Backend URL: ${BACKEND_URL}"

# Fall back to backend Cloud Run URL if no custom domain was set
PUBLIC_BASE="${PUBLIC_BASE:-${BACKEND_URL}}"

# Patch FRONTEND_URL on the backend now that PUBLIC_BASE is resolved.
# FRONTEND_URL must point at the user-facing frontend (evols.ai), not the backend.
FRONTEND_BASE="${EVOLS_DOMAIN:+https://${EVOLS_DOMAIN}}"
FRONTEND_BASE="${FRONTEND_BASE:-${BACKEND_URL}}"
echo "==> Patching OIDC_ISSUER and FRONTEND_URL on evols-backend..."
gcloud run services update evols-backend \
  --region "${REGION}" --platform managed \
  --update-env-vars "OIDC_ISSUER=${PUBLIC_BASE}/api/v1/oidc,FRONTEND_URL=${FRONTEND_BASE}" \
  --project "${PROJECT_ID}"

# ── 1b. LightRAG — build custom image + deploy ────────────────────────────────
# We maintain a patched LightRAG image (evols-lightrag) that adds ENTITY_ATTRIBUTES
# support.  The patch lives in lightrag-entity-attributes.patch and is applied at
# build time on top of the upstream lightrag-hku wheel.
#
# WARNING: Never use `gcloud run services update --set-env-vars` for LightRAG — it
# replaces ALL env vars and falls back to Ollama defaults, wiping the config.
# Always redeploy with the full env var set (see the block below).
# EMBEDDING_TIMEOUT=120 → worker timeout 240s to handle Bedrock cold-start latency.
LIGHTRAG_IMAGE="${LIGHTRAG_IMAGE:-us-central1-docker.pkg.dev/${PROJECT_ID}/evols-repo/evols-lightrag:latest}"
SQL_CONNECTION_NAME="${SQL_CONNECTION_NAME:-$(gcloud sql instances describe evols-postgres --format='value(connectionName)' --project "${PROJECT_ID}")}"

echo "==> Building evols-lightrag image..."
gcloud builds submit --config=deployment/cloudbuild-lightrag.yaml \
  --substitutions="_TAG=${LIGHTRAG_IMAGE}" \
  --project "${PROJECT_ID}" .

echo "==> Deploying evols-lightrag..."
# Build env-vars file to safely pass JSON values (gcloud --set-env-vars chokes on brackets).
# NetworkXStorage writes graph.graphml to WORKING_DIR; mount GCS bucket there so it
# survives container restarts and redeploys without needing Cloud NAT or AGE extension.
# Ensure the GCS bucket exists for persistent graph storage (free within normal GCS pricing).
gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://evols-lightrag-storage" 2>/dev/null || true
# Grant the default compute SA (used by Cloud Run) object-level access.
DEFAULT_SA="${PROJECT_NUMBER:-$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')}"-compute@developer.gserviceaccount.com
gsutil iam ch "serviceAccount:${DEFAULT_SA}:objectAdmin" gs://evols-lightrag-storage 2>/dev/null || true

LIGHTRAG_ENV_FILE="$(mktemp /tmp/lightrag-env-XXXXXX.yaml)"
python3 - <<PYEOF
env = {
    "LIGHTRAG_KV_STORAGE": "PGKVStorage",
    "LIGHTRAG_VECTOR_STORAGE": "PGVectorStorage",
    "LIGHTRAG_GRAPH_STORAGE": "NetworkXStorage",
    "LIGHTRAG_DOC_STATUS_STORAGE": "PGDocStatusStorage",
    "POSTGRES_HOST": "/cloudsql/${SQL_CONNECTION_NAME}",
    "POSTGRES_PORT": "5432",
    "POSTGRES_DATABASE": "evols",
    "POSTGRES_USER": "postgres",
    "LLM_BINDING": "openai",
    "LLM_MODEL": "claude-haiku-4-5-20251001",
    "LLM_BINDING_HOST": "${BACKEND_URL}/api/v1/llm-proxy/bedrock",
    "EMBEDDING_BINDING": "openai",
    "EMBEDDING_MODEL": "amazon.titan-embed-text-v2:0",
    "EMBEDDING_DIM": "1024",
    "EMBEDDING_BINDING_HOST": "${BACKEND_URL}/api/v1/llm-proxy/bedrock",
    "EMBEDDING_TIMEOUT": "120",
    "MAX_ASYNC": "2",
    "MAX_TOKENS": "32768",
    "ENTITY_TYPES": '["Person","Organization","Product","Feature","PainPoint","FeatureRequest","Persona","Competitor","BusinessGoal","Metric","Decision","Meeting","Project","Technology","Market"]',
    "ENTITY_ATTRIBUTES": '["sentiment","urgency","business_impact","context_snippet","confidence"]',
    "ENTITY_ATTRIBUTE_VALUES": '{"sentiment":["positive","mostly_positive","neutral","mostly_negative","negative"],"urgency":["critical","high","medium","low","minimal"],"business_impact":["transformative","high","medium","low","negligible"]}',
    "AUTH_ACCOUNTS": "evols:${LIGHTRAG_API_KEY}",
    "TOKEN_SECRET": "81cedc8e5042e71ccfb779dee55a8480d9e92f76080b1ccd8e34d7356a5b1b02",
}
with open("${LIGHTRAG_ENV_FILE}", "w") as f:
    for k, v in env.items():
        f.write(f"{k}: {repr(v)}\n")
PYEOF

gcloud run deploy evols-lightrag \
  --image "${LIGHTRAG_IMAGE}" \
  --region "${REGION}" --platform managed \
  --allow-unauthenticated \
  --ingress=all \
  --min-instances=1 \
  --env-vars-file "${LIGHTRAG_ENV_FILE}" \
  --set-secrets "POSTGRES_PASSWORD=lightrag-pg-password:latest" \
  --set-secrets "LLM_BINDING_API_KEY=lightrag-api-key:latest" \
  --set-secrets "EMBEDDING_BINDING_API_KEY=lightrag-api-key:latest" \
  --add-cloudsql-instances "${SQL_CONNECTION_NAME}" \
  --add-volume="name=graph-storage,type=cloud-storage,bucket=evols-lightrag-storage" \
  --add-volume-mount="volume=graph-storage,mount-path=/app/data/rag_storage" \
  --project "${PROJECT_ID}" || echo "Warning: LightRAG deploy failed (service may not exist yet)"

rm -f "${LIGHTRAG_ENV_FILE}"

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

echo "==> Uploading resolved librechat.yaml to GCS..."
# librechat.yaml is excluded from the Docker image (.dockerignore: librechat*)
# so we resolve env vars and serve it via CONFIG_PATH from GCS instead.
LIBRECHAT_CONFIG_BUCKET="evols-config"
gsutil mb -p "${PROJECT_ID}" "gs://${LIBRECHAT_CONFIG_BUCKET}" 2>/dev/null || true
sed "s|\${EVOLS_BACKEND_URL}|${PUBLIC_BASE}|g" "${WORKBENCH_DIR}/librechat.yaml" \
  | gsutil cp - "gs://${LIBRECHAT_CONFIG_BUCKET}/librechat.yaml"
gsutil acl ch -u AllUsers:R "gs://${LIBRECHAT_CONFIG_BUCKET}/librechat.yaml"
LIBRECHAT_CONFIG_URL="https://storage.googleapis.com/${LIBRECHAT_CONFIG_BUCKET}/librechat.yaml"

echo "==> Storing workbench secrets..."
store_secret "workbench-mongo-uri"             "${MONGO_URI}"
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
  --min-instances=1 --max-instances=1 \
  --port=3080 \
  --set-env-vars="NODE_ENV=production,HOST=0.0.0.0,BASE_PATH=/workbench/app,APP_BASE_PATH=/workbench/app,ALLOW_REGISTRATION=false,ALLOW_EMAIL_LOGIN=false,EVOLS_BACKEND_URL=${PUBLIC_BASE},DOMAIN_CLIENT=${FRONTEND_BASE}/workbench/app,DOMAIN_SERVER=${FRONTEND_BASE},CONFIG_PATH=${LIBRECHAT_CONFIG_URL}" \
  --set-secrets="MONGO_URI=workbench-mongo-uri:latest,JWT_SECRET=workbench-jwt-secret:latest,JWT_REFRESH_SECRET=workbench-jwt-refresh-secret:latest,CREDS_KEY=workbench-creds-key:latest,CREDS_IV=workbench-creds-iv:latest,OPENID_SESSION_SECRET=workbench-openid-session-secret:latest"

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
