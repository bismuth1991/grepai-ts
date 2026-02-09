ARG BUN_VERSION=1.3.9
ARG TURBO_VERSION=2.8.3
ARG VARIANT=debian

################
# BASE ALPLINE #
################
FROM oven/bun:${BUN_VERSION}-alpine AS base-alpine

RUN apk add --no-cache nodejs python3 make g++

###############
# BASE DEBIAN #
###############
FROM oven/bun:${BUN_VERSION}-debian AS base-debian

RUN apt-get update && apt-get install -y --no-install-recommends \
  nodejs \
  npm \
  python3 \
  python3-setuptools \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

########
# BASE #
########
FROM base-${VARIANT} AS base

ENV NODE_ENV="production"

WORKDIR /app

RUN mkdir -p out/json \
  && mkdir -p out/full \
  && chown -R bun:bun .

USER bun

###########
# PREPARE #
###########
FROM base AS prepare

RUN bun add turbo@${TURBO_VERSION}

##########
# PRUNED #
##########
FROM prepare AS pruned

COPY --chown=bun:bun . .

RUN bun turbo prune @grepai/cli-dev --docker --out-dir out

#########
# BUILD #
#########
FROM prepare AS build

COPY --from=pruned --chown=bun:bun /app/out/json/ .

COPY --chown=bun:bun packages/core/src/internal/scripts/patch-tree-sitter.ts ./packages/core/src/internal/scripts/patch-tree-sitter.ts

RUN bun install

COPY --from=pruned --chown=bun:bun /app/out/full/ .

RUN bun turbo run build

############
# ARTIFACT #
############
FROM scratch AS artifact

COPY --from=build /app/packages/cli-dev/dist/grepai /grepai
