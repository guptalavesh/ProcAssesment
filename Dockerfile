# Backend-only image for Cloud Run.
# The frontend is built and uploaded to Firebase Hosting separately —
# see scripts/deploy_to_gcp.sh.

FROM python:3.11-slim

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

EXPOSE 8080
WORKDIR /app/backend

# Cloud Run injects PORT. Bind to 0.0.0.0 on whichever port it sets.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
