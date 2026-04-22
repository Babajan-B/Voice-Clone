#!/bin/bash
# Start the FastAPI backend and Next.js frontend with health checks.
# Logs: /tmp/voice-backend.log, /tmp/voice-frontend.log

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ── Ensure Node/npm is on PATH ─────────────────────────
# Fresh shells launched from GUI may not source ~/.zshrc.
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
[ -f "$HOME/.zshrc" ] && source "$HOME/.zshrc" >/dev/null 2>&1 || true
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "✗ npm not found on PATH. Install Node 18+ (e.g. 'brew install node') and retry."
  exit 1
fi

# ── Port checks ────────────────────────────────────────
check_port() {
  local port=$1 name=$2
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "⚠ Port $port is already in use (needed for $name)."
    echo "  Run this to see which process: lsof -nP -iTCP:$port -sTCP:LISTEN"
    echo "  Kill with: kill \$(lsof -nP -iTCP:$port -sTCP:LISTEN -t)"
    return 1
  fi
  return 0
}

check_port 8000 backend || exit 1
check_port 3000 frontend || {
  echo "  Continuing anyway — Next will fall back to 3001."
}

# ── Backend ────────────────────────────────────────────
if [ ! -f "venv/bin/python" ]; then
  echo "✗ venv/ not found. Create it and install backend deps first:"
  echo "    python3 -m venv venv"
  echo "    ./venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

echo "→ Starting backend on http://127.0.0.1:8000"
(cd backend && ../venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload) \
  > /tmp/voice-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend healthcheck (up to 30s)
echo -n "  Waiting for backend"
for i in {1..30}; do
  if curl -s -f -o /dev/null http://127.0.0.1:8000/api/voices 2>/dev/null; then
    echo " ✓"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo ""
    echo "✗ Backend died during startup. Last log lines:"
    tail -20 /tmp/voice-backend.log
    exit 1
  fi
  echo -n "."
  sleep 1
done

# ── Frontend ───────────────────────────────────────────
if [ ! -d "frontend/node_modules" ]; then
  echo "→ Installing frontend dependencies..."
  (cd frontend && npm install)
fi

echo "→ Starting frontend on http://localhost:3000"
(cd frontend && npm run dev) > /tmp/voice-frontend.log 2>&1 &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "→ Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Voice Clone"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  UI:        http://localhost:3000"
echo "  API:       http://127.0.0.1:8000"
echo "  API docs:  http://127.0.0.1:8000/docs"
echo ""
echo "  Backend log:  tail -f /tmp/voice-backend.log"
echo "  Frontend log: tail -f /tmp/voice-frontend.log"
echo ""
echo "  Press Ctrl+C to stop both servers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

wait
