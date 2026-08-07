# ─────────────────────────────────────────────────────────────────────
# Backend Dockerfile
# Multi-stage: installs deps then copies app
# ─────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System dependencies for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (leverages Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create data directories
RUN mkdir -p data/documents data/vectordb

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
