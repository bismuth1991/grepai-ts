#!/usr/bin/env bash
set -euo pipefail

BUILDER_NAME="multiarch-builder"

if ! docker buildx inspect "$BUILDER_NAME" &>/dev/null; then
  docker buildx create --name "$BUILDER_NAME" --driver docker-container --use
else
  docker buildx use "$BUILDER_NAME"
fi

declare -A BUILDS=(
  ["linux/amd64-alpine"]="linux-x64-musl"
  ["linux/amd64-debian"]="linux-x64"
  ["linux/arm64-alpine"]="linux-arm64-musl"
)

for key in "${!BUILDS[@]}"; do
  suffix="${BUILDS[$key]}"
  platform="${key%-*}"
  variant="${key##*-}"
  dest="../../releases/cli-${suffix}/bin"

  echo "==> Building ${suffix}"
  mkdir -p "$dest"

  docker buildx build \
    --platform "$platform" \
    --build-arg VARIANT="$variant" \
    --target artifact \
    --output "type=local,dest=${dest}" \
    --file "./Dockerfile" \
    ../../
done
