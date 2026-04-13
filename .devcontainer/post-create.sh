#!/usr/bin/env bash
set -e

# Install dependencies
if test -f package.json; then
  pnpm install
else
  echo "No package.json yet - project not initialized"
fi

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
