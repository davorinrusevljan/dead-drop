#!/bin/bash
# Clean restart of local dev servers
# Usage: ./scripts/restart-dev.sh

set -e

echo "🛑 Stopping all dev processes..."
kill -9 $(ps aux | grep -E "turbo|next|node.*9090" | grep -v grep | awk '{print $2}') 2>/dev/null || true
sleep 2

echo "🧹 Cleaning build cache..."
rm -rf /workspaces/dead-drop/apps/core/.next

echo "🚀 Starting API on port 9090..."
cd /workspaces/dead-drop/apps/core && pnpm dev:api &>/tmp/api.log &
sleep 5

if curl -s -o /dev/null -w "" http://localhost:9090/api/v1/health 2>/dev/null; then
    echo "   ✅ API healthy"
else
    echo "   ❌ API failed to start. Check /tmp/api.log"
    exit 1
fi

echo "🚀 Starting UI on port 3010..."
cd /workspaces/dead-drop && pnpm dev &>/tmp/ui.log &
sleep 10

if curl -s -o /dev/null -w "" http://localhost:3010 2>/dev/null; then
    echo "   ✅ UI healthy"
else
    echo "   ❌ UI failed to start. Check /tmp/ui.log"
    exit 1
fi

echo ""
echo "✅ Both servers running:"
echo "   API: http://localhost:9090"
echo "   UI:  http://localhost:3010"
