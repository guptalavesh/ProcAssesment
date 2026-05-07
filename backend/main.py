from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

# ── v1 engine path injection ──────────────────────────────────────────────────
# The v2 backend wraps the v1 engine without copying it. Both paths are tried
# so the app works regardless of cwd (local dev vs Cloud Run container).
_HERE = Path(__file__).parent
for _engine_root in [
    _HERE.parent.parent / "Assessment App",
    _HERE.parent / "Assessment App",
    _HERE.parent,                   # repo root — picks up engine/ stub on Cloud Run
]:
    if (_engine_root / "engine").exists():
        sys.path.insert(0, str(_engine_root))
        print(f"[startup] engine path: {_engine_root}")
        break

app = FastAPI(title="Assessment App v2", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production, Firebase Hosting rewrites /api/** to this Cloud Run service.
# That's same-origin from the browser's perspective, so CORS isn't strictly
# needed there. We still allow:
#   * localhost:5173 — Vite dev server during local development
#   * the Firebase Hosting domain for the deployed frontend
#   * anything in CORS_ALLOWED_ORIGINS env var (custom domains)
_FIREBASE_PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "")
_DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if _FIREBASE_PROJECT:
    _DEFAULT_ORIGINS.extend([
        f"https://{_FIREBASE_PROJECT}.web.app",
        f"https://{_FIREBASE_PROJECT}.firebaseapp.com",
    ])

_extra = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if _extra:
    _DEFAULT_ORIGINS.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_DEFAULT_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ──────────────────────────────────────────────────────────────
# Cloud Run probes this on startup. Kept cheap — never touches DB / LLM.
@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "procassesment",
        "version": "2.0.0",
        "vertex_project": os.environ.get("GEMINI_VERTEX_PROJECT", "unset"),
    }


# ── Routers ───────────────────────────────────────────────────────────────────
from routers import session as session_router

PREFIX = "/api/v1"

app.include_router(session_router.router, prefix=PREFIX)

_optional_routers = [
    ("routers.setup",          "router"),
    ("routers.upload",         "router"),
    ("routers.column_review",  "router"),
    ("routers.configure",      "router"),
    ("routers.run",            "router"),
    ("routers.results",        "router"),
    ("routers.kpi_dashboard",  "router"),
    ("routers.ai_insights",    "router"),
    ("routers.ppt_export",     "router"),
    ("routers.formula_review", "router"),
    ("routers.file_inspect",   "router"),
]

for module_name, attr in _optional_routers:
    try:
        import importlib
        mod = importlib.import_module(module_name)
        router = getattr(mod, attr)
        app.include_router(router, prefix=PREFIX)
        print(f"[startup] loaded {module_name}")
    except Exception as e:
        print(f"[startup] SKIP {module_name}: {e}")

# ── Local dev fallback: serve frontend/dist if present ────────────────────────
# Firebase Hosting handles static assets in production. This branch only runs
# when someone builds the frontend locally and wants to test the prod bundle
# served from FastAPI on a single port.
_DIST = _HERE.parent / "frontend" / "dist"
if _DIST.exists():
    _ASSETS = _DIST / "assets"
    if _ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")

    @app.get("/")
    async def root_index():
        index = _DIST / "index.html"
        return FileResponse(index) if index.exists() else JSONResponse(
            {"detail": "Frontend not built"}, status_code=404
        )

    print(f"[startup] local-dev: serving frontend from {_DIST}")
else:
    print(f"[startup] API-only mode (frontend served by Firebase Hosting in prod)")


# ── Startup tasks ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup():
    from session_store import cleanup_expired
    cleanup_expired()
    print(f"[startup] PORT={os.environ.get('PORT', '8002')} "
          f"PROJECT={os.environ.get('GEMINI_VERTEX_PROJECT', 'unset')} "
          f"LOCATION={os.environ.get('GEMINI_VERTEX_LOCATION', 'us-central1')}")
