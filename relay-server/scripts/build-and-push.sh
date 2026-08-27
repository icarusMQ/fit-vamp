#!/usr/bin/env bash
# Builds both relay images and pushes them to ECR. Run this from your own
# machine (needs Docker + AWS CLI configured with push permissions) — not
# on the EC2 instance, which only ever pulls.
#
# Usage:
#   AWS_REGION=us-east-1 ./scripts/build-and-push.sh [image-tag]
#
# AWS_ACCOUNT_ID is auto-detected via `aws sts get-caller-identity` if not
# set. image-tag defaults to "latest".

set -euo pipefail
cd "$(dirname "$0")/.."

AWS_REGION="${AWS_REGION:?Set AWS_REGION, e.g. AWS_REGION=us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
TAG="${1:-latest}"
REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

RELAY_REPO="fittrack-relay"
COURT_REPO="fittrack-court-upload"

for repo in "$RELAY_REPO" "$COURT_REPO"; do
  aws ecr describe-repositories --repository-names "$repo" --region "$AWS_REGION" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$repo" --region "$AWS_REGION" >/dev/null
done

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

docker build -f Dockerfile.relay -t "$REGISTRY/$RELAY_REPO:$TAG" .
docker push "$REGISTRY/$RELAY_REPO:$TAG"

docker build -f Dockerfile.court-upload -t "$REGISTRY/$COURT_REPO:$TAG" .
docker push "$REGISTRY/$COURT_REPO:$TAG"

echo
echo "Pushed:"
echo "  $REGISTRY/$RELAY_REPO:$TAG"
echo "  $REGISTRY/$COURT_REPO:$TAG"
