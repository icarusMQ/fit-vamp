#!/usr/bin/env bash
# Builds both relay images and pushes them to one ECR repo, as two tags
# ("relay" and "court-upload") rather than two separate repos. Run this
# from your own machine (needs Docker + AWS CLI configured with push
# permissions) — not on the EC2 instance, which only ever pulls.
#
# Usage:
#   ECR_REPO=123456789012.dkr.ecr.sa-east-1.amazonaws.com/icaro/fitvamp ./scripts/build-and-push.sh

set -euo pipefail
cd "$(dirname "$0")/.."

ECR_REPO="${ECR_REPO:?Set ECR_REPO, e.g. ECR_REPO=123456789012.dkr.ecr.sa-east-1.amazonaws.com/icaro/fitvamp}"
REGISTRY="${ECR_REPO%%/*}"
REPO_NAME="${ECR_REPO#*/}"
AWS_REGION="${AWS_REGION:-$(echo "$REGISTRY" | cut -d. -f4)}"

aws ecr describe-repositories --repository-names "$REPO_NAME" --region "$AWS_REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO_NAME" --region "$AWS_REGION" >/dev/null

aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY"

docker build -f Dockerfile.relay -t "$ECR_REPO:relay" .
docker push "$ECR_REPO:relay"

docker build -f Dockerfile.court-upload -t "$ECR_REPO:court-upload" .
docker push "$ECR_REPO:court-upload"

echo
echo "Pushed:"
echo "  $ECR_REPO:relay"
echo "  $ECR_REPO:court-upload"
