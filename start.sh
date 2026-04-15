#!/bin/bash
# AutoVJ Launcher - builds frontend + starts server on port 3456
cd "$(dirname "$0")"

# Find Node.js
if command -v node &>/dev/null; then
  export PATH="$(dirname $(which node)):$PATH"
elif [ -f "/usr/local/Cellar/node@22/22.22.2_1/bin/node" ]; then
  export PATH="/usr/local/Cellar/node@22/22.22.2_1/bin:$PATH"
elif [ -f "/opt/homebrew/bin/node" ]; then
  export PATH="/opt/homebrew/bin:$PATH"
fi

# Build frontend if dist/ doesn't exist or source is newer
if [ ! -d "dist" ] || [ "src/main.js" -nt "dist/index.html" ]; then
  echo "Building frontend..."
  npx vite build --logLevel error
fi

# Kill any existing instance
lsof -ti :3456 2>/dev/null | xargs kill -9 2>/dev/null

echo "Starting AutoVJ on http://localhost:3456"
echo ""

# Open browser
open "http://localhost:3456" 2>/dev/null &

# Start server (foreground so Ctrl+C stops it)
node server/index.js
