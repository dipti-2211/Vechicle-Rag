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
#   gcc / g++ / build-essential  — C extension compilation
#   libgomp1                     — OpenMP (sentence-transformers / onnxruntime)
#   libglib2.0-0                 — chromadb hnswlib dependency
#   libsm6 / libxext6            — PDF processing libraries
#   curl                         — health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    build-essential \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy requirements first — this layer is cached until requirements.txt changes
COPY requirements.txt .

# ── Step 1: Install CPU-only PyTorch FIRST ───────────────────────────────────
# This MUST happen before sentence-transformers to prevent pip from pulling
# the CUDA-enabled default torch wheels (~3GB) which will fail or OOM on Render.
# Using the official PyTorch CPU index for smaller, faster builds.
RUN pip install --no-cache-dir \
    "torch==2.13.0" \
    --index-url https://download.pytorch.org/whl/cpu

# ── Step 2: Install remaining app requirements ────────────────────────────────
# sentence-transformers will detect torch is already installed (CPU version)
# and won't try to reinstall it.
RUN pip install --no-cache-dir -r requirements.txt

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Runtime-only system libraries (no compilers needed at runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
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
# 120s start period allows time for ML model download on first boot
HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Start Application ─────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
