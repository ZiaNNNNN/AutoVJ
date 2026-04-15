#!/bin/bash
# AutoVJ Launcher - starts both backend and frontend
cd "$(dirname "$0")"
export PATH="/usr/local/Cellar/node@22/22.22.2_1/bin:$PATH"

echo "Starting AutoVJ..."
echo ""

# Start backend in background
node server/index.js &
SERVER_PID=$!
echo "Backend started (PID: $SERVER_PID)"

# Start frontend
echo "Starting frontend..."
echo ""
npx vite --host

# When frontend exits, kill backend
kill $SERVER_PID 2>/dev/null
