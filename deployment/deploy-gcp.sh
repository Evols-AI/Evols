#!/bin/bash
# Evols Cloud Run Deployment Script

set -e

PROJECT_ID=$1
REGION=${2:-us-central1}
REPOSITORY="evols-repo"

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy-gcp.sh PROJECT_ID [REGION]"
    exit 1
fi

echo "🚀 Starting deployment to Cloud Run for project: $PROJECT_ID in region: $REGION"

# 1. Enable APIs
echo "Enabling necessary APIs..."
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com --project "$PROJECT_ID"

# 2. Build and Push Backend Image
echo "Building backend image..."
gcloud builds submit --config=deployment/cloudbuild-backend.yaml \
    --substitutions=_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/evols-backend:latest" \
    --project "$PROJECT_ID" .

# 3. Deploy Backend
echo "Deploying backend to Cloud Run..."
SQL_CONNECTION_NAME=$(gcloud sql instances describe evols-postgres --format='value(connectionName)' --project "$PROJECT_ID")

gcloud run deploy evols-backend \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/evols-backend:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "DATABASE_URL=postgresql+asyncpg://postgres:postgres@/evols?host=/cloudsql/$SQL_CONNECTION_NAME" \
    --set-env-vars "ENVIRONMENT=production" \
    --set-env-vars "REDIS_URL=redis://10.128.0.43:6379/0" \
    --set-env-vars 'BACKEND_CORS_ORIGINS=["*"]' \
    --set-env-vars "TAVILY_API_KEY=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" \
    --add-cloudsql-instances "$SQL_CONNECTION_NAME" \
    --network default \
    --subnet default \
    --vpc-egress private-ranges-only \
    --project "$PROJECT_ID"

BACKEND_URL=$(gcloud run services describe evols-backend --region "$REGION" --format='value(status.url)' --project "$PROJECT_ID")
echo "Backend URL: $BACKEND_URL"

# 4. Build and Push Frontend Image (with Backend URL)
echo "Building frontend image with API URL: $BACKEND_URL..."
gcloud builds submit --config=deployment/cloudbuild-frontend.yaml \
    --substitutions=_TAG="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/evols-frontend:latest",_API_URL="$BACKEND_URL" \
    --project "$PROJECT_ID" .

# 5. Deploy Frontend
echo "Deploying frontend to Cloud Run..."
gcloud run deploy evols-frontend \
    --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/evols-frontend:latest" \
    --region "$REGION" \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars "NEXT_PUBLIC_API_URL=$BACKEND_URL" \
    --project "$PROJECT_ID"

FRONTEND_URL=$(gcloud run services describe evols-frontend --region "$REGION" --format='value(status.url)' --project "$PROJECT_ID")

echo "✅ Cloud Run Deployment Complete!"
echo "--------------------------------------------------"
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"
echo "--------------------------------------------------"
