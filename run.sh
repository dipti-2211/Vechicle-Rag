#!/usr/bin/env bash
# =============================================================================
# Vehicle Intelligence Assistant — Development Server Runner
# Starts the FastAPI backend AND Vite React frontend concurrently.
#
# Usage:
#   bash run.sh          # Start both servers
#   bash run.sh stop     # Kill any servers on ports 8000 / 5173
# =============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# ── Helper: kill processes on a port ─────────────────────────────────
free_port() {
  local port=$1
  local pid
  pid=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    echo "  ⚠️  Port $port is in use (PID $pid) — killing..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# ── Stop mode ─────────────────────────────────────────────────────────
if [ "$1" = "stop" ]; then
  echo "🛑 Stopping Vehicle Intelligence Assistant servers..."
  free_port 8000
  free_port 5173
  echo "✅ Done."
  exit 0
fi

# ── Cleanup on Ctrl+C / exit ──────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "🛑 Stopping servers..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  # Small pause to let processes die cleanly
  sleep 1
  echo "✅ All servers stopped."
  exit 0
}

trap cleanup INT TERM

# ── Pre-flight checks ─────────────────────────────────────────────────
echo "=================================================="
echo "🚗  Vehicle Intelligence Assistant"
echo "=================================================="
echo ""

# Ensure backend .env exists
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo "⚠️  WARNING: backend/.env not found!"
  echo "   Copy backend/.env.example → backend/.env and add your GEMINI_API_KEY."
  echo ""
fi

# Check backend venv
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
  echo "❌ ERROR: Python virtual environment not found at backend/venv"
  echo "   Run:  cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

# Check frontend node_modules
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
  echo "❌ ERROR: node_modules not found. Run:  cd frontend && npm install"
  exit 1
fi

# Free ports if already in use
free_port 8000
free_port 5173

# ── Start Backend ─────────────────────────────────────────────────────
echo "📦 [1/2] Starting FastAPI backend on http://localhost:8000 ..."
# IMPORTANT: Must cd into backend/ so pydantic-settings finds .env in CWD
cd "$SCRIPT_DIR/backend"

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
  # Windows Git Bash
  source venv/Scripts/activate
fi

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend to be ready (poll /health endpoint)
echo "   Waiting for backend to be ready..."
MAX_WAIT=30
waited=0
while [ $waited -lt $MAX_WAIT ]; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend ready!"
    break
  fi
  sleep 1
  waited=$((waited + 1))
done

if [ $waited -ge $MAX_WAIT ]; then
  echo "   ⚠️  Backend did not respond in ${MAX_WAIT}s — check logs above for errors."
fi

# ── Start Frontend ────────────────────────────────────────────────────
echo ""
echo "⚛️  [2/2] Starting React frontend on http://localhost:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Done ──────────────────────────────────────────────────────────────
echo ""
echo "=================================================="
echo "✨  Both servers are running!"
echo ""
echo "   🌐  Frontend UI  →  http://localhost:5173"
echo "   🚀  Backend API  →  http://localhost:8000"
echo "   📚  API Docs     →  http://localhost:8000/docs"
echo ""
echo "   Press Ctrl+C to stop all servers."
echo "=================================================="
echo ""

# Keep script alive until Ctrl+C
wait $BACKEND_PID $FRONTEND_PID
