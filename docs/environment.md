# Environment Configuration

## Local Development

For local development, copy `.env.example` to `.env.local`:

```bash
cp apps/core/.env.example apps/core/.env.local
```

This sets `NEXT_PUBLIC_API_URL` to `http://localhost:9090` (local API server).

**Do not commit `.env.local`** - it is in `.gitignore`.

## Production Deployment

When deploying to Cloudflare Pages, the `deploy:pages` script explicitly sets the production API URL:

```bash
NEXT_PUBLIC_API_URL=https://api.dead-drop.xyz pnpm deploy:pages
```

This overrides any `.env.local` settings.

## How It Works

- **Local**: Uses `.env.local` (if exists) → `http://localhost:9090`
- **Production**: Build script sets env var → `https://api.dead-drop.xyz`
- **Fallback**: If neither set → `https://api.dead-drop.xyz` (from `lib/config.ts`)

## Running Dev Servers

```bash
# Terminal 1: Start API
pnpm dev:api

# Terminal 2: Start Frontend  
pnpm dev
```

Both will use `http://localhost:9090` for API calls.
