#!/bin/bash
#test
set -e

IMAGE="us-central1-docker.pkg.dev/anvil-private/nextjs-repo/nextjs-app"
SERVICE="private-nextjs-site"
REGION="us-central1"
PROJECT="anvil-private"

echo "Submitting build to Cloud Build..."
gcloud builds submit --tag "$IMAGE" --project="$PROJECT"

echo "Deploying to Cloud Run..."
gcloud run services update "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT" \
  --image="$IMAGE"

echo "Done! Deployed successfully."
