# ─────────────────────────────────────────────────────────────────────────────
# Auron — Vehicle Intelligence Assistant
# Backend Dockerfile (Production-Ready)
#
# Two-stage build:
#   Stage 1 (builder): install all Python deps
#   Stage 2 (runtime): copy only what's needed, keep image lean
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

# System dependencies required to compile Python packages:
#   gcc / g++ / build-essential  — C extension compilation (chromadb, etc.)
#   libglib2.0-0                 — chromadb hnswlib dependency
#   libsm6 / libxext6            — PDF processing libraries
#   curl                         — health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first — this layer is cached until requirements.txt changes
COPY requirements.txt .

# Install all app requirements
# (PyTorch / sentence-transformers are no longer in requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Runtime-only system libraries (no compilers needed at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages from builder stage
COPY --from=builder /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application source code
COPY . .

# Create required runtime data directories
RUN mkdir -p data/chroma data/uploads uploads && \
    chmod -R 755 data uploads

# ── Environment Defaults (overridden by Render env vars) ─────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    APP_ENV=production \
    DATABASE_PATH=/app/data/vehicle_intelligence.db \
    UPLOAD_DIR=/app/data/uploads \
    CHROMA_PERSIST_DIR=/app/data/chroma \
    PORT=8000

EXPOSE 8000

# ── Health Check ──────────────────────────────────────────────────────────────
# 30s start period is enough — no ML model download needed at startup
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Start Application ─────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
