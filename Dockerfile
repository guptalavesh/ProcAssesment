# Build the React frontend, then bundle it into a Python image that
# serves both the FastAPI backend and the static frontend.

FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY engine/  engine/
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV PORT=8002
EXPOSE 8002
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
