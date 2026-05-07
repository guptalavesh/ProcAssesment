# ─────────────────────────────────────────────────────────────────────────
# ProcAssesment — single-image Cloud Run build.
# Stage 1: build the Vite/React frontend.
# Stage 2: bundle FastAPI backend + frontend dist into a slim Python image.
# ─────────────────────────────────────────────────────────────────────────

# ── Stage 1 — build the React frontend ───────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
# Copy lockfile + manifest first for layer caching.
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ── Stage 2 — runtime ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Avoid creating .pyc files and force unbuffered stdout (better Cloud Run logs).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

WORKDIR /app

# Install Python deps (cached unless requirements.txt changes).
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source + engine stub.
COPY backend/ backend/
COPY engine/  engine/

# Copy the built frontend bundle from stage 1.
COPY --from=frontend /app/frontend/dist /app/frontend/dist

EXPOSE 8080
WORKDIR /app/backend
# Cloud Run injects PORT — bind to 0.0.0.0 on whichever port it sets.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
