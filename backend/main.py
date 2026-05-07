from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ── v1 engine path injection ──────────────────────────────────────────────────
# The v2 backend wraps the v1 engine without copying it.
# Both paths are tried so the app works regardless of cwd.
_HERE = Path(__file__).parent
for _engine_root in [
    _HERE.parent.parent / "Assessment App",
    _HERE.parent / "Assessment App",
]:
    if (_engine_root / "engine").exists():
        sys.path.insert(0, str(_engine_root))
        print(f"[startup] engine path: {_engine_root}")
        break

app = FastAPI(title="Assessment App v2", version="2.0.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ── Serve React build (production) ────────────────────────────────────────────
_DIST = _HERE.parent / "frontend" / "dist"
if _DIST.exists():
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="static")
    print(f"[startup] serving frontend from {_DIST}")

# ── Session cleanup ───────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup():
    from session_store import cleanup_expired
    cleanup_expired()
    print("[startup] session cleanup complete")
