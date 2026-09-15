#!/usr/bin/env bash
set -e

# Install dependencies
if test -f package.json; then
  pnpm install
  # Install browsers for the WORKSPACE playwright version — playwright is a
  # root-workspace devDependency (e2e/ has no package.json, so no --filter).
  # Using the workspace version avoids the browser-revision drift an
  # image-build global playwright caused (#7), and --with-deps resolves the
  # full system-dep set per browser incl. webkit.
  pnpm exec playwright install --with-deps chromium firefox webkit
else
  echo "No package.json yet - project not initialized"
fi

# Install/upgrade pi agent globally (package was renamed from
# @mariozechner/pi-coding-agent to @earendil-works/pi-coding-agent;
# the old 0.73.x build doesn't provide the @earendil-works/* runtime
# imports this repo's extensions use)
npm install -g @earendil-works/pi-coding-agent@latest

# Configure pi agent for GLM-5.1 via Z.AI Coding Plan
PI_HOME="${HOME:-/root}/.pi/agent"
mkdir -p "$PI_HOME"

# Create models.json for GLM-5.1 (only if not already present from persisted volume)
if [ ! -f "$PI_HOME/models.json" ]; then
cat > "$PI_HOME/models.json" << 'PI_MODELS'
{
  "providers": {
    "zai": {
      "baseUrl": "https://api.z.ai/api/coding/paas/v4",
      "api": "openai-completions",
      "apiKey": "$ZAI_API_KEY",
      "models": [
        {
          "id": "glm-5.1",
          "name": "GLM-5.1",
          "reasoning": true,
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 131072
        }
      ]
    }
  }
}
PI_MODELS
else
  echo "models.json already exists — keeping persisted config"
fi

# Create empty auth.json placeholder (real credentials resolve via
# models.json apiKey: "$ZAI_API_KEY" env interpolation — do NOT store a
# literal string here, it would be sent as the bearer token and 401)
if [ ! -f "$PI_HOME/auth.json" ]; then
  echo '{}' > "$PI_HOME/auth.json"
fi

echo "Pi agent configured for GLM-5.1 (Z.AI Coding Plan)"
echo "Set ZAI_API_KEY environment variable before running pi"

# Install caveman plugin for claude-code
ACTUAL_HOME="${HOME:-/root}"
CLAUDE_DIR="$ACTUAL_HOME/.claude"
CLAUDE_SETTINGS="$CLAUDE_DIR/settings.json"
PLUGIN_CACHE="$CLAUDE_DIR/plugins/cache/caveman/caveman"

if [ ! -d "$PLUGIN_CACHE" ]; then
  echo "Installing caveman plugin..."
  mkdir -p "$PLUGIN_CACHE"

  # Clone latest release from GitHub
  git clone --depth 1 https://github.com/JuliusBrussee/caveman.git "$PLUGIN_CACHE/latest" 2>/dev/null
fi

# Merge caveman config into settings.json
if [ -f "$CLAUDE_SETTINGS" ]; then
  # Use node to merge JSON (available in container)
  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync('$CLAUDE_SETTINGS', 'utf8'));
    s.enabledPlugins = s.enabledPlugins || {};
    s.enabledPlugins['caveman@caveman'] = true;
    s.extraKnownMarketplaces = s.extraKnownMarketplaces || {};
    s.extraKnownMarketplaces.caveman = {
      source: { source: 'github', repo: 'JuliusBrussee/caveman' }
    };
    fs.writeFileSync('$CLAUDE_SETTINGS', JSON.stringify(s, null, 2) + '\n');
  "
else
  mkdir -p "$CLAUDE_DIR"
  cat > "$CLAUDE_SETTINGS" << 'SETTINGS'
{
  "enabledPlugins": {
    "caveman@caveman": true
  },
  "extraKnownMarketplaces": {
    "caveman": {
      "source": {
        "source": "github",
        "repo": "JuliusBrussee/caveman"
      }
    }
  }
}
SETTINGS
fi

echo "Caveman plugin installed."
