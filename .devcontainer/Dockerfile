# dead-drop Dev Container
# Includes all tools needed for development

FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    procps \
    lsof \
    # Playwright/Chromium deps — cache-warm base only (see note below)
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Firefox dependencies
    libdbus-glib-1-2 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm 9.x
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install global npm packages
RUN pnpm config set global-bin-dir /usr/local/bin && \
    pnpm add -g \
    turbo \
    wrangler \
    @biomejs/biome \
    vite \
    vitest \
    @anthropic-ai/claude-code

# NOTE: no global `playwright` and no image-build browser install — browsers
# are provisioned in post-create.sh with the WORKSPACE playwright version.
# A global playwright writes browser revisions that drift from the repo's
# own playwright and break e2e out of the box (#7).

# The apt dep list above stays as a cache-warm base only; post-create.sh
# `playwright install --with-deps` is the source of truth.

# Set working directory
WORKDIR /workspace

# Set shell
SHELL ["/bin/bash", "-c"]
