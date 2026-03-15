# dead-drop.xyz

A privacy-focused, ephemeral data-sharing service running on Cloudflare Workers.

## Development Setup

### Prerequisites

Before starting, ensure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [VS Code](https://code.visualstudio.com/)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- Git

### Getting Started

1. **Clone and open in dev container:**
   ```bash
   git clone <repository-url>
   cd dead-drop
   code .
   ```

2. **Reopen in container:**
   - VS Code will prompt "Reopen in Container"
   - Click "Reopen in Container"
   - Wait for container to build (first time takes a few minutes)

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

4. **Start development:**
   ```bash
   pnpm dev
   ```

### What's Included

The dev container includes:
- Node.js 22.x (LTS)
- pnpm 9.x
- wrangler (Cloudflare Workers CLI)
- Turborepo CLI
- Vitest (testing)
- Biome (linting/formatting)

### Useful Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all dev servers |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all code |
| `wrangler dev` | Start local Workers dev server |

## Documentation

- [Design Document](./initial-design.md) - Full system design
- [API Documentation](./docs/api.md) - API reference (coming soon)
