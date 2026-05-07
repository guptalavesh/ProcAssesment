from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request
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
# Local Vite dev server hits this from a different origin. Production serves
# the React build from the same FastAPI process, so CORS is moot there — but
# the wildcard Cloud Run hostname is harmless to allow alongside localhost.
_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
_extra = os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if _extra:
    _ALLOWED_ORIGINS.extend([o.strip() for o in _extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ──────────────────────────────────────────────────────────────
# Cloud Run probes this on startup. Keep it cheap — never touch DB / LLM.
@app.get("/health")
def health():
    return {"ok": True, "service": "procassesment", "version": "2.0.0"}


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

# ── Serve React build + SPA fallback ──────────────────────────────────────────
# The Dockerfile builds the frontend and copies it to /app/frontend/dist.
# We mount /assets for hashed bundles, but route every other GET that isn't an
# /api/* call to index.html so React Router handles it client-side.
_DIST = _HERE.parent / "frontend" / "dist"
if _DIST.exists():
    _ASSETS = _DIST / "assets"
    if _ASSETS.exists():
        app.mount("/assets", StaticFiles(directory=_ASSETS), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str, request: Request):
        # Don't shadow the API or health endpoint.
        if full_path.startswith("api/") or full_path == "health":
            return JSONResponse({"detail": "Not found"}, status_code=404)
        # If a real file exists in dist (favicon, robots.txt, etc.), serve it.
        candidate = _DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        index = _DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        return JSONResponse({"detail": "Frontend not built"}, status_code=404)

    print(f"[startup] serving frontend from {_DIST}")
else:
    print(f"[startup] frontend build not found at {_DIST} — API only mode")


# ── Session cleanup ───────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup():
    from session_store import cleanup_expired
    cleanup_expired()
    print("[startup] session cleanup complete")
    print(f"[startup] PORT={os.environ.get('PORT', '8002')} "
          f"PROJECT={os.environ.get('GEMINI_VERTEX_PROJECT', 'unset')} "
          f"LOCATION={os.environ.get('GEMINI_VERTEX_LOCATION', 'us-central1')}")
