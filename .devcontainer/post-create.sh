#!/usr/bin/env bash
set -e

# Install dependencies
if test -f package.json; then
  pnpm install
else
  echo "No package.json yet - project not initialized"
fi

# Install pi agent globally
if ! command -v pi &> /dev/null; then
  echo "Installing pi agent..."
  npm install -g @mariozechner/pi-coding-agent
else
  echo "pi agent already installed"
fi

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
      "apiKey": "ZAI_API_KEY",
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

# Create auth.json placeholder
if [ ! -f "$PI_HOME/auth.json" ]; then
  cat > "$PI_HOME/auth.json" << 'PI_AUTH'
{
  "zai": {
    "type": "api_key",
    "key": "ZAI_API_KEY"
  }
}
PI_AUTH
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
