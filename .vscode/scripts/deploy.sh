#!/bin/bash
set -euo pipefail

IMAGE="tkgling/aivisspeech-discord-bot:latest"
PLATFORMS="linux/amd64,linux/arm64"

# マルチアーキテクチャ対応のビルダーを作成・使用
BUILDER_NAME="multiarch-builder"
if ! docker buildx inspect "$BUILDER_NAME" &>/dev/null; then
  echo "=== Creating buildx builder ==="
  docker buildx create --name "$BUILDER_NAME" --use --driver docker-container
else
  docker buildx use "$BUILDER_NAME"
fi

# マルチアーキテクチャビルド & Docker Hubへプッシュ
echo "=== Building and pushing ${IMAGE} (${PLATFORMS}) ==="
docker buildx build \
  --platform "$PLATFORMS" \
  --tag "$IMAGE" \
  --push \
  .

echo "=== Push complete ==="
