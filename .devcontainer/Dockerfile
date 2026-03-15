# dead-drop Dev Container
# Includes all tools needed for development

FROM node:22-bookworm-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
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

# Set working directory
WORKDIR /workspace

# Set shell
SHELL ["/bin/bash", "-c"]
