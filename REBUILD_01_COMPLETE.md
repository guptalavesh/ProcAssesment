# REBUILD GUIDE — Part 1: Environment, Setup & Core Backend Files
# Complete self-contained source code — no other files needed

## CRITICAL: READ THIS FIRST

This is **Part 1 of 5** of a complete rebuild guide. Together the 5 parts contain every line of source
code needed to recreate the Accenture Procurement Maturity Assessment app from scratch.

**Tech Stack:**
- Backend: FastAPI (Python 3.11+) on port 8002
- Frontend: Vite + React 18 + TypeScript on port 5173
- Styling: Tailwind CSS + Framer Motion + Lucide icons
- AI: Vertex AI Gemini 2.5 Pro (via `google-cloud-aiplatform`)
- In-memory session store (Python dict, 4-hour TTL)
- SSE for run progress streaming

**Brand tokens:** `#a100ff` (brand-purple) / `#460073` (brand-dark) / `#7500c0` (brand-mid)

---

## 1. FOLDER STRUCTURE

```
Assessment App v2/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── session_store.py
│   ├── serializers.py
│   ├── requirements.txt
│   └── routers/
│       ├── session.py
│       ├── setup.py
│       ├── upload.py
│       ├── column_review.py
│       ├── configure.py
│       ├── run.py
│       ├── results.py
│       ├── kpi_dashboard.py
│       ├── ai_insights.py
│       ├── ai_usecases.py
│       ├── ppt_export.py
│       ├── formula_review.py
│       └── file_inspect.py
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── styles/
│       │   └── globals.css
│       ├── store/
│       │   └── assessmentStore.ts
│       ├── lib/
│       │   ├── api.ts
│       │   ├── types.ts
│       │   └── utils.ts
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── SetupPage.tsx
│       │   ├── UploadPage.tsx
│       │   ├── ColumnReviewPage.tsx
│       │   ├── ConfigurePage.tsx
│       │   ├── RunningPage.tsx
│       │   ├── FormulaReviewPage.tsx
│       │   ├── ResultsPage.tsx
│       │   └── NotFoundPage.tsx
│       └── components/
│           ├── layout/
│           │   ├── AppShell.tsx
│           │   ├── Sidebar.tsx
│           │   ├── PageHeader.tsx
│           │   └── ErrorBoundary.tsx
│           ├── ui/
│           │   ├── ScoreGauge.tsx
│           │   ├── AnimatedCounter.tsx
│           │   ├── Skeleton.tsx
│           │   ├── EmptyState.tsx
│           │   ├── AccentureMark.tsx
│           │   └── AccentureLogo.tsx
│           ├── results/
│           │   ├── ScoreHero.tsx
│           │   ├── KpiBucketCards.tsx
│           │   ├── KpiDashboard.tsx
│           │   ├── AiInsightsMini.tsx
│           │   ├── RCATab.tsx
│           │   ├── OfferingsTab.tsx
│           │   ├── DimensionsTab.tsx
│           │   ├── MaturityRadar.tsx
│           │   └── IframeViewer.tsx
│           └── upload/
│               ├── QuestionnaireSection.tsx
│               └── DiscoveryQRESection.tsx
└── "../Assessment App/engine/"   ← v1 engine (see Part 2)
```

The backend imports from v1 engine via:
```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'Assessment App'))
```

---

## 2. ENVIRONMENT SETUP

### Backend (.env)
```
# Place at: backend/.env
GEMINI_VERTEX_PROJECT=gen-lang-client-0226029743
GEMINI_VERTEX_LOCATION=us-central1
# Optional overrides:
# S2P_PROCESS_PATH=C:\path\to\S2P_Process_L1_L5_RACI.xlsx
# BPR_NAVIGATOR_PATH=C:\path\to\PH-BPRNavigator.xlsx
```

### Backend requirements.txt
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
python-multipart>=0.0.9
pydantic>=2.7.0
pandas>=2.2.0
openpyxl>=3.1.2
xlrd>=2.0.1
python-pptx>=0.6.23
google-cloud-aiplatform>=1.49.0
```

### Start Backend
```bash
cd "Assessment App v2/backend"
python -m uvicorn main:app --reload --port 8002
```

### Frontend package.json
```json
{
  "name": "assessment-app-v2",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.0",
    "framer-motion": "^11.2.10",
    "lucide-react": "^0.378.0",
    "recharts": "^2.12.7",
    "react-dropzone": "^14.2.3",
    "zustand": "^4.5.2",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.2.12",
    "tailwindcss": "^3.4.3",
    "postcss": "^8.4.38",
    "autoprefixer": "^10.4.19"
  }
}
```

### Start Frontend
```bash
cd "Assessment App v2/frontend"
npm install
npm run dev
```

---

## 3. backend/main.py

```python
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
```

---

## 4. backend/config.py

```python
from __future__ import annotations
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"

COLOURS = {
    "leading":      "#2E7D32",
    "advanced":     "#1565C0",
    "intermediate": "#E65100",
    "foundation":   "#C62828",
    "insufficient": "#96968c",
}

SCORE_LABELS = {
    4: "Leading",
    3: "Advanced",
    2: "Intermediate",
    1: "Foundation",
}

# Scoring thresholds (upper-inclusive)
SCORE_THRESHOLDS = {
    "leading":      (3.5, 4.0),
    "advanced":     (2.5, 3.49),
    "intermediate": (1.5, 2.49),
    "foundation":   (0.0, 1.49),
}

BRAND_PURPLE = "#a100ff"
BRAND_DARK   = "#460073"
BRAND_MID    = "#7500c0"
```

---

## 5. backend/session_store.py

```python
from __future__ import annotations

import time
import uuid
from typing import Any, Dict

# ── In-memory session store ───────────────────────────────────────────────────
# Sessions are plain Python dicts stored in a module-level dict.
# TTL = 4 hours. The startup event calls cleanup_expired() once.

_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 4 * 3600  # 4 hours


def _empty_session() -> Dict[str, Any]:
    return {
        # ── Identity ──────────────────────────────────────────────────────────
        "created_at": time.time(),
        "session_id": None,
        # ── Setup ─────────────────────────────────────────────────────────────
        "engagement":   None,  # dict with client_name, industry, fte_count, etc.
        "skill_config": None,  # SkillConfig object from v1 engine
        # ── Data ──────────────────────────────────────────────────────────────
        "dataframes":   {
            "po_df": None, "pr_df": None, "qre_df": None,
            "invoice_df": None, "workforce_df": None,
            "inventory_df": None, "goods_movement_df": None,
            "po_gr_df": None, "production_df": None, "maintenance_df": None,
            "quality_df": None,
        },
        "pdf_bytes":    None,
        "pdf_filename": None,
        # ── Column resolution ─────────────────────────────────────────────────
        "col_resolution": None,   # ColumnResolutionResult object
        "final_col_map":  {},     # {logical_name: actual_column}
        "confirmed_cols": {},
        "unavailable_cols": [],
        # ── Configuration ─────────────────────────────────────────────────────
        "weight_config":     {},  # {dim_id: float 0-1}
        "include_dims":      {},  # {dim_id: bool}
        "kpi_weight_config": {},  # {kpi_id: float 0-1}
        "formula_overrides": {},  # {kpi_id: {benchmark: float, multipliers: {}}}
        "formula_params":    {},  # {kpi_id: {param_key: value}}
        # ── Run ───────────────────────────────────────────────────────────────
        "run_done":  False,
        "run_error": None,
        "run_queue": None,  # queue.Queue for SSE events
        # ── Results ───────────────────────────────────────────────────────────
        "kpi_results":    None,
        "dim_results":    None,
        "overall_result": None,
        "kpi_assessment": None,
        "data_bundle":    None,
        "insights":       None,
        "report_bytes":   None,
        # ── QRE / text ────────────────────────────────────────────────────────
        "text_qre_results":    None,
        "text_qre_confirmed":  {},
        "questionnaire_detail": {},
        "discovery_qre":       {},
        # ── AI caches ─────────────────────────────────────────────────────────
        "ai_insights":              None,
        "ai_tab_insights_kpi_overview": None,
        "ai_tab_insights_rca":      None,
        "ai_tab_insights_offerings": None,
        "ai_buying_categories":     None,
        # ── LLM config ────────────────────────────────────────────────────────
        "llm_api_key":  None,
        "llm_base_url": "https://api.openai.com/v1",
        "llm_model":    "gpt-4o-mini",
    }


def create_session() -> str:
    sid = str(uuid.uuid4())
    sess = _empty_session()
    sess["session_id"] = sid
    _SESSIONS[sid] = sess
    return sid


def get_session(session_id: str) -> Dict[str, Any]:
    sess = _SESSIONS.get(session_id)
    if sess is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Session {session_id!r} not found or expired.")
    # Renew TTL on access
    sess["created_at"] = time.time()
    return sess


def delete_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)


def cleanup_expired() -> int:
    now = time.time()
    expired = [sid for sid, sess in _SESSIONS.items()
               if now - sess.get("created_at", 0) > SESSION_TTL_SECONDS]
    for sid in expired:
        del _SESSIONS[sid]
    return len(expired)
```

---

## 6. backend/serializers.py

```python
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional


def _clean(v):
    """Replace NaN/Inf with None for JSON safety."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def serialize_dimension_result(dr) -> Dict[str, Any]:
    """Serialize a v1 DimensionResult to a JSON-safe dict."""
    if dr is None:
        return {}
    if isinstance(dr, dict):
        return {k: _clean(v) for k, v in dr.items()}

    # Derive data_source from status field
    status = getattr(dr, "status", None)
    data_source = (
        "computed"     if status in ("scored", "partial") else
        "qre"          if status == "qre_only" else
        "unavailable"  if status == "insufficient" else
        "unavailable"
    )
    # Override: if text_qre_confirmed was applied, data_source = "qre"
    if hasattr(dr, "data_source") and dr.data_source:
        data_source = dr.data_source

    kpi_scores: Dict[str, Any] = {}
    if hasattr(dr, "kpi_scores") and dr.kpi_scores:
        for kid, ksr in dr.kpi_scores.items():
            kpi_scores[kid] = {
                "score":  _clean(getattr(ksr, "score", None)),
                "actual": _clean(getattr(ksr, "actual", None)),
                "weight": _clean(getattr(ksr, "weight", None)),
            }

    return {
        "dim_id":       getattr(dr, "dim_id", None),
        "name":         getattr(dr, "name", None),
        "score":        _clean(getattr(dr, "score", None)),
        "score_display":_clean(getattr(dr, "score_display", None)),
        "level":        getattr(dr, "level", None),
        "weight":       _clean(getattr(dr, "weight", None)),
        "status":       status,
        "data_source":  data_source,
        "evidence":     getattr(dr, "evidence", []) or [],
        "gaps":         getattr(dr, "gaps", []) or [],
        "rationale":    getattr(dr, "rationale", ""),
        "target_state": getattr(dr, "target_state", ""),
        "recommended_actions": getattr(dr, "recommended_actions", []) or [],
        "kpi_scores":   kpi_scores,
        "data_sufficiency": getattr(dr, "data_sufficiency", None),
    }


def serialize_overall_result(overall) -> Dict[str, Any]:
    if overall is None:
        return {}
    if isinstance(overall, dict):
        return {k: _clean(v) for k, v in overall.items()}
    return {
        "score":            _clean(getattr(overall, "score", None)),
        "score_display":    _clean(getattr(overall, "score_display", None)),
        "level":            getattr(overall, "level", None),
        "scored_dims":      getattr(overall, "scored_dims", 0),
        "total_dims":       getattr(overall, "total_dims", 0),
        "active_weight_pct":_clean(getattr(overall, "active_weight_pct", None)),
        "description":      getattr(overall, "description", ""),
    }


def serialize_kpi_result(kr) -> Dict[str, Any]:
    if kr is None:
        return {}
    if isinstance(kr, dict):
        return {k: _clean(v) for k, v in kr.items()}

    actual = _clean(getattr(kr, "actual", None))
    benchmark = _clean(getattr(kr, "benchmark", None))
    direction = getattr(kr, "direction", "higher_is_better")
    unit = getattr(kr, "unit", "")

    # Format actual and benchmark for display
    def _fmt(v, u):
        if v is None: return "—"
        if u == "%": return f"{round(v * 100)}%"
        if u == "days": return f"{round(v)} days"
        if u == "₹ Cr": return f"₹{round(v, 1)} Cr"
        return str(round(v, 2))

    # Gap percentage
    gap_pct = None
    if actual is not None and benchmark is not None and benchmark != 0:
        if direction == "higher_is_better":
            gap_pct = _clean((actual - benchmark) / abs(benchmark))
        else:
            gap_pct = _clean((benchmark - actual) / abs(benchmark))

    return {
        "kpi_id":    getattr(kr, "kpi_id", None),
        "label":     getattr(kr, "label", ""),
        "actual":    actual,
        "benchmark": benchmark,
        "score":     _clean(getattr(kr, "score", None)),
        "score_label": getattr(kr, "score_label", None),
        "direction": direction,
        "unit":      unit,
        "weight":    _clean(getattr(kr, "weight", None)),
        "bucket":    getattr(kr, "bucket", ""),
        "gap_pct":   gap_pct,
        "formatted_actual":    _fmt(actual, unit),
        "formatted_benchmark": _fmt(benchmark, unit),
        "available": getattr(kr, "available", True),
    }


def serialize_kpi_assessment(ka) -> Optional[Dict[str, Any]]:
    if ka is None:
        return None
    if isinstance(ka, dict):
        return ka

    kpi_results = {}
    for kid, kr in (getattr(ka, "kpi_results", None) or {}).items():
        kpi_results[kid] = serialize_kpi_result(kr)

    bucket_results = {}
    for bname, br in (getattr(ka, "bucket_results", None) or {}).items():
        bucket_kpis = []
        for kr in (getattr(br, "kpis", None) or []):
            bucket_kpis.append({
                "kpi_id": getattr(kr, "kpi_id", None),
                "label":  getattr(kr, "label", ""),
                "score":  _clean(getattr(kr, "score", None)),
                "score_label": getattr(kr, "score_label", None),
            })
        bucket_results[bname] = {
            "bucket":      bname,
            "score":       _clean(getattr(br, "score", None)),
            "score_label": getattr(br, "score_label", None),
            "kpis":        bucket_kpis,
        }

    return {
        "overall_score":  _clean(getattr(ka, "overall_score", None)),
        "overall_label":  getattr(ka, "overall_label", None),
        "kpi_results":    kpi_results,
        "bucket_results": bucket_results,
        "computed_kpis":  list(kpi_results.keys()),
    }


def serialize_insight_card(ic) -> Dict[str, Any]:
    if ic is None:
        return {}
    if isinstance(ic, dict):
        return ic
    return {
        "title":       getattr(ic, "title", ""),
        "description": getattr(ic, "description", ""),
        "category":    getattr(ic, "category", ""),
        "severity":    getattr(ic, "severity", "info"),
        "value":       _clean(getattr(ic, "value", None)),
        "benchmark":   _clean(getattr(ic, "benchmark", None)),
    }


def serialize_diagnostic(diag) -> Dict[str, Any]:
    if diag is None:
        return {}
    if isinstance(diag, dict):
        return diag
    return {
        "summary":      getattr(diag, "summary", ""),
        "strengths":    getattr(diag, "strengths", []) or [],
        "gaps":         getattr(diag, "gaps", []) or [],
        "priorities":   getattr(diag, "priorities", []) or [],
        "risk_flags":   getattr(diag, "risk_flags", []) or [],
    }
```

---

## 7. backend/routers/session.py

```python
from fastapi import APIRouter
from session_store import create_session, delete_session, get_session

router = APIRouter(tags=["session"])


@router.post("/session")
def new_session():
    sid = create_session()
    return {"session_id": sid}


@router.delete("/session/{session_id}")
def end_session(session_id: str):
    delete_session(session_id)
    return {"ok": True}


@router.get("/session/{session_id}/state")
def session_state(session_id: str):
    sess = get_session(session_id)
    return {
        "has_engagement":  sess.get("engagement") is not None,
        "has_skill":       sess.get("skill_config") is not None,
        "has_data":        any(v is not None for v in sess["dataframes"].values()),
        "has_results":     sess.get("overall_result") is not None,
        "run_done":        sess.get("run_done", False),
        "run_error":       sess.get("run_error"),
        "needs_col_review":sess.get("col_resolution") is not None and
                           (sess["col_resolution"].needs_user_review()
                            if hasattr(sess.get("col_resolution", object()), "needs_user_review")
                            else False),
    }
```

---

## 8. frontend/vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 9. frontend/tailwind.config.ts

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-purple': '#a100ff',
        'brand-dark':   '#460073',
        'brand-mid':    '#7500c0',
        'bg-secondary': '#f3f0f8',
        'bg-muted':     '#ede9f4',
        'caption':      '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## 10. frontend/src/styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

@layer base {
  body {
    @apply font-sans text-brand-dark bg-white;
    -webkit-font-smoothing: antialiased;
  }
  * { box-sizing: border-box; }
}

@layer components {
  /* ── Accenture card ── */
  .acc-card {
    @apply bg-white border border-bg-secondary rounded-xl p-4 shadow-sm;
  }

  /* ── Score badge ── */
  .score-badge {
    @apply inline-block px-2 py-0.5 rounded text-xs font-bold;
  }

  /* ── Accenture table ── */
  .acc-table {
    @apply w-full text-sm border-collapse;
  }
  .acc-table th {
    @apply text-left text-xs font-bold text-brand-dark px-3 py-2
           bg-bg-secondary border-b border-bg-muted uppercase tracking-wide;
  }
  .acc-table td {
    @apply px-3 py-2 border-b border-bg-secondary/50 text-black;
  }
  .acc-table tbody tr:hover {
    @apply bg-bg-secondary/40;
  }

  /* ── Page header (dark gradient) ── */
  .page-header {
    @apply rounded-xl p-5 mb-5
           bg-gradient-to-r from-brand-dark via-brand-mid to-brand-purple
           text-white shadow-md;
  }

  /* ── Focus ring ── */
  .focus-ring {
    @apply focus:outline-none focus:ring-2 focus:ring-brand-purple focus:ring-offset-1;
  }

  /* ── CTA hover scale ── */
  .btn-cta {
    @apply hover:scale-[1.02] active:scale-[0.98] transition-transform;
  }
}

/* ── Animated gradient for Landing hero ── */
@keyframes gradient-shift {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
.animate-gradient {
  background-size: 200% 200%;
  animation: gradient-shift 8s ease infinite;
}

/* ── Scrollbar styling ── */
::-webkit-scrollbar       { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #f3f0f8; }
::-webkit-scrollbar-thumb { background: #a100ff55; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #a100ff99; }
```

---

## 11. frontend/src/App.tsx

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ErrorBoundary from '@/components/layout/ErrorBoundary'

import LandingPage       from '@/pages/LandingPage'
import SetupPage         from '@/pages/SetupPage'
import UploadPage        from '@/pages/UploadPage'
import ColumnReviewPage  from '@/pages/ColumnReviewPage'
import ConfigurePage     from '@/pages/ConfigurePage'
import RunningPage       from '@/pages/RunningPage'
import FormulaReviewPage from '@/pages/FormulaReviewPage'
import ResultsPage       from '@/pages/ResultsPage'
import NotFoundPage      from '@/pages/NotFoundPage'

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Landing — full width, no sidebar */}
          <Route path="/" element={<LandingPage />} />

          {/* Assessment wizard — wrapped in AppShell with sidebar */}
          <Route element={<AppShell />}>
            <Route path="/setup"          element={<SetupPage />} />
            <Route path="/upload"         element={<UploadPage />} />
            <Route path="/columns"        element={<ColumnReviewPage />} />
            <Route path="/configure"      element={<ConfigurePage />} />
            <Route path="/running"        element={<RunningPage />} />
            <Route path="/formula-review" element={<FormulaReviewPage />} />
            <Route path="/results"        element={<ResultsPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
```

---

## 12. frontend/src/main.tsx

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

---

## 13. frontend/src/store/assessmentStore.ts

```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScreenType =
  | 'setup' | 'upload' | 'columns' | 'configure'
  | 'running' | 'formula-review' | 'results'

export type AiContext = 'kpi_overview' | 'rca' | 'offerings'

interface AssessmentState {
  // ── Session ──────────────────────────────────────────────────────────────
  sessionId: string | null
  setSessionId: (id: string) => void

  // ── Skill ─────────────────────────────────────────────────────────────────
  skillPath: string | null
  skillName: string | null
  isProcurement: boolean
  setSkill: (path: string, name: string, isProcurement: boolean) => void

  // ── Client ────────────────────────────────────────────────────────────────
  clientName: string
  setClientName: (name: string) => void

  // ── Navigation ────────────────────────────────────────────────────────────
  screen: ScreenType
  setScreen: (s: ScreenType) => void

  // ── Upload result ─────────────────────────────────────────────────────────
  uploadResult: any
  setUploadResult: (r: any) => void

  // ── Configure state ───────────────────────────────────────────────────────
  configureState: any
  setConfigureState: (s: any) => void

  // ── AI insights (per-tab cache) ───────────────────────────────────────────
  aiInsights: Record<AiContext, any>
  aiLoading:  Record<AiContext, boolean>
  aiError:    Record<AiContext, string>
  setAiInsight: (ctx: AiContext, data: any) => void
  setAiLoading: (ctx: AiContext, v: boolean) => void
  setAiError:   (ctx: AiContext, e: string) => void
  clearAiCache: () => void

  // ── AI opt-in (once user generates on any tab, auto-generate on all) ──────
  aiOptedIn: boolean
  setAiOptedIn: (v: boolean) => void

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset: () => void
}

const DEFAULT_AI: Record<AiContext, any> = {
  kpi_overview: null,
  rca:          null,
  offerings:    null,
}

const DEFAULT_LOADING: Record<AiContext, boolean> = {
  kpi_overview: false,
  rca:          false,
  offerings:    false,
}

const DEFAULT_ERROR: Record<AiContext, string> = {
  kpi_overview: '',
  rca:          '',
  offerings:    '',
}

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set) => ({
      // Session
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),

      // Skill
      skillPath: null,
      skillName: null,
      isProcurement: false,
      setSkill: (path, name, isProcurement) =>
        set({ skillPath: path, skillName: name, isProcurement }),

      // Client
      clientName: '',
      setClientName: (name) => set({ clientName: name }),

      // Navigation
      screen: 'setup',
      setScreen: (screen) => set({ screen }),

      // Upload
      uploadResult: null,
      setUploadResult: (uploadResult) => set({ uploadResult }),

      // Configure
      configureState: null,
      setConfigureState: (configureState) => set({ configureState }),

      // AI
      aiInsights: { ...DEFAULT_AI },
      aiLoading:  { ...DEFAULT_LOADING },
      aiError:    { ...DEFAULT_ERROR },

      setAiInsight: (ctx, data) =>
        set((s) => ({ aiInsights: { ...s.aiInsights, [ctx]: data } })),
      setAiLoading: (ctx, v) =>
        set((s) => ({ aiLoading: { ...s.aiLoading, [ctx]: v } })),
      setAiError: (ctx, e) =>
        set((s) => ({ aiError: { ...s.aiError, [ctx]: e } })),

      clearAiCache: () =>
        set({ aiInsights: { ...DEFAULT_AI }, aiError: { ...DEFAULT_ERROR } }),

      aiOptedIn: false,
      setAiOptedIn: (v) => set({ aiOptedIn: v }),

      // Reset
      reset: () => set({
        sessionId: null, skillPath: null, skillName: null,
        isProcurement: false, clientName: '', screen: 'setup',
        uploadResult: null, configureState: null,
        aiInsights: { ...DEFAULT_AI }, aiLoading: { ...DEFAULT_LOADING },
        aiError: { ...DEFAULT_ERROR }, aiOptedIn: false,
      }),
    }),
    {
      name: 'assessment-v2-store',
      // Only persist session identity + skill — not the large AI payloads
      partialize: (s) => ({
        sessionId:    s.sessionId,
        skillPath:    s.skillPath,
        skillName:    s.skillName,
        isProcurement: s.isProcurement,
        clientName:   s.clientName,
        screen:       s.screen,
        aiOptedIn:    s.aiOptedIn,
      }),
    }
  )
)
```

---

## 14. frontend/src/lib/utils.ts

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return '#96968c'
  if (score >= 3.5)  return '#2E7D32'
  if (score >= 2.5)  return '#1565C0'
  if (score >= 1.5)  return '#E65100'
  return '#C62828'
}

export function scoreBg(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-100 text-gray-600'
  if (score >= 3.5)  return 'bg-green-100 text-green-800'
  if (score >= 2.5)  return 'bg-blue-100 text-blue-800'
  if (score >= 1.5)  return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function scoreLabel(score: number | null | undefined): string {
  if (score == null) return 'Insufficient Data'
  if (score >= 3.5)  return 'Leading'
  if (score >= 2.5)  return 'Advanced'
  if (score >= 1.5)  return 'Intermediate'
  return 'Foundation'
}

/** Indian crore formatter: 1,23,45,678 → "₹1.23 Cr" */
export function formatCr(value: number | null | undefined): string {
  if (value == null) return '—'
  const cr = value / 1e7
  if (cr >= 1000) return `₹${(cr / 1000).toFixed(1)}K Cr`
  if (cr >= 100)  return `₹${cr.toFixed(0)} Cr`
  if (cr >= 10)   return `₹${cr.toFixed(1)} Cr`
  return `₹${cr.toFixed(2)} Cr`
}

export function formatPct(value: number | null | undefined, decimals = 0): string {
  if (value == null) return '—'
  return `${value.toFixed(decimals)}%`
}

/** Round n to d decimal places. Uses int(x + 0.5) to avoid banker's rounding. */
export function roundN(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals)
  return Math.floor(value * factor + 0.5) / factor
}

/** Format large Indian integers with lakh/crore separators */
export function formatIndianInt(value: number): string {
  if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)} Cr`
  if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)} L`
  return `₹${value.toLocaleString('en-IN')}`
}
```

---

## 15. frontend/src/lib/types.ts

```ts
// ── Skill / Setup ──────────────────────────────────────────────────────────
export interface SkillSummary {
  path: string
  display_name: string
  function_name: string
  dimension_count: number
  schema_version: string
  is_procurement: boolean
}

export interface Engagement {
  client_name: string
  industry: string
  assessment_type: string
  date: string
  assessor_name?: string
  notes?: string
  fte_count?: number | null
  annual_spend?: number | null
  annual_revenue?: number | null
}

// ── Column resolution ─────────────────────────────────────────────────────
export interface ColumnResolutionState {
  resolved: Record<string, string>
  suggestions: Record<string, { suggested: string; confidence: number }>
  unmatched: string[]
  available_columns: string[]
  skill_aliases: Record<string, string>
}

// ── Configure ─────────────────────────────────────────────────────────────
export interface DimensionConfig {
  dim_id: string
  name: string
  weight: number
  kpi_count: number
  default_weight: number
}

export interface ConfigureState {
  is_procurement: boolean
  dimensions: DimensionConfig[]
  engagement: { fte_count: number | null; annual_spend: number | null; industry: string }
  kpi_meta?: Record<string, { label: string; weight: number; direction: string; unit: string; bucket: string }>
  buckets?: Record<string, string[]>
  bucket_icons?: Record<string, string>
  data_ready?: Record<string, boolean>
  benchmarks_display?: Record<string, string>
}

// ── Results ───────────────────────────────────────────────────────────────
export interface OverallResult {
  score: number | null
  score_display: number | null
  level: string | null
  scored_dims: number
  total_dims: number
  active_weight_pct: number | null
  description: string
  dimension_score?: number | null
}

export interface KpiResult {
  kpi_id: string
  label: string
  actual: number | null
  benchmark: number | null
  score: number | null
  score_label: string | null
  direction: 'higher_is_better' | 'lower_is_better'
  unit: string
  weight: number | null
  bucket: string
  gap_pct: number | null
  formatted_actual: string
  formatted_benchmark: string
  available: boolean
}

export interface BucketResult {
  bucket: string
  score: number | null
  score_label: string | null
  kpis: { kpi_id: string; label: string; score: number | null; score_label: string | null }[]
}

export interface KPIAssessmentResult {
  overall_score: number | null
  overall_label: string | null
  kpi_results: Record<string, KpiResult>
  bucket_results: Record<string, BucketResult>
  computed_kpis: string[]
}

export interface DimensionResult {
  dim_id: string
  name: string
  score: number | null
  score_display: number | null
  level: string | null
  weight: number
  status: string
  data_source: 'computed' | 'qre' | 'unavailable'
  evidence: string[]
  gaps: string[]
  rationale: string
  target_state: string
  recommended_actions: string[]
  kpi_scores: Record<string, { score: number | null; actual: number | null; weight: number | null }>
  data_sufficiency: string | null
}

// ── Run / Progress ────────────────────────────────────────────────────────
export interface ProgressEvent {
  step?: number
  total?: number
  pct?: number
  message?: string
  status?: 'running' | 'done' | 'error'
}

// ── KPI Dashboard ─────────────────────────────────────────────────────────
export interface KpiTrendPoint {
  month: string
  value: number
}

export interface KpiDrillItem {
  name: string
  value: number
  pct?: number
}

export interface KpiData {
  id: string
  label: string
  available: boolean
  value: number | null
  unit: string
  benchmark: number | null
  direction: 'higher_is_better' | 'lower_is_better'
  trend: KpiTrendPoint[]
  by_plant: KpiDrillItem[]
  by_vendor: KpiDrillItem[]
  by_category: KpiDrillItem[]
  by_purchase_group: KpiDrillItem[]
  confidence?: 'low' | 'medium' | 'high'
  confidence_reason?: string
  row_count?: number
}

export interface DashboardSummary {
  total_spend_cr: number
  po_count: number
  vendor_count: number
  date_range?: { min: string; max: string }
}

export interface DashboardFilters {
  plants: string[]
  categories: string[]
  purchase_groups: string[]
}

export interface DashboardData {
  kpis: Record<string, KpiData>
  summary: DashboardSummary
  filters: DashboardFilters
  low_confidence: boolean
  row_count: number
}

// ── Buying Channel ────────────────────────────────────────────────────────
export interface BuyingChannelRow {
  mg_code: string
  mg_desc: string
  archetype: 'BULK' | 'DIRECT' | 'INDIRECT' | 'CAPEX' | 'SERVICE'
  current_channel: string
  recommended_channel: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  spend_cr: number
  spend_pct: number
  po_count: number
  asis_tat: number | null
  tobe_tat: number | null
  signal: string
}
```

---

## 16. frontend/src/lib/api.ts

```ts
// All API calls to the FastAPI backend

const BASE = '/api/v1'

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const opts: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  // ── Session ──────────────────────────────────────────────────────────────
  createSession: ()        => request<{ session_id: string }>('POST', '/session'),
  deleteSession: (sid: string) => request('DELETE', `/session/${sid}`),
  sessionState:  (sid: string) => request('GET',    `/session/${sid}/state`),

  // ── Setup ─────────────────────────────────────────────────────────────────
  getSkills: () => request<any[]>('GET', '/skills'),

  setup: (sid: string, data: any) =>
    request('POST', `/session/${sid}/setup`, data),

  getQuestionnaire: (skillPath: string) =>
    request<any>('GET', `/skills/questionnaire?skill_path=${encodeURIComponent(skillPath)}`),

  saveQuestionnaireDetail: (sid: string, detail: Record<string, Record<string, number>>) =>
    request('POST', `/session/${sid}/questionnaire-detail`, { detail }),

  getDiscoveryQuestions: () =>
    request<any>('GET', '/discovery-qre/questions'),

  saveDiscoveryQRE: (sid: string, answers: Record<string, string>) =>
    request('POST', `/session/${sid}/discovery-qre`, { answers }),

  getDiscoveryQRE: (sid: string) =>
    request<any>('GET', `/session/${sid}/discovery-qre`),

  // ── Upload ────────────────────────────────────────────────────────────────
  uploadFiles: (
    sid: string,
    files: Record<string, File | null>,
    onProgress?: (pct: number) => void,
    sheets?: Record<string, string | null>,
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      for (const [key, file] of Object.entries(files)) {
        if (file) fd.append(key, file)
      }
      if (sheets) {
        for (const [key, sheet] of Object.entries(sheets)) {
          if (sheet) fd.append(key.replace('_file', '_sheet'), sheet)
        }
      }
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/session/${sid}/upload`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress)
          onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => {
        if (xhr.status < 400) resolve(JSON.parse(xhr.responseText))
        else {
          try { reject(new Error(JSON.parse(xhr.responseText).detail || 'Upload failed')) }
          catch { reject(new Error('Upload failed')) }
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send(fd)
    })
  },

  inspectFiles: (files: File[]): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${BASE}/files/inspect`)
      xhr.onload = () => {
        if (xhr.status < 400) resolve(JSON.parse(xhr.responseText))
        else {
          try { reject(new Error(JSON.parse(xhr.responseText).detail || 'Inspect failed')) }
          catch { reject(new Error('Inspect failed')) }
        }
      }
      xhr.onerror = () => reject(new Error('Network error'))
      xhr.send(fd)
    })
  },

  parseTextQre: (sid: string, text: string) =>
    request('POST', `/session/${sid}/parse-text-qre`, { text }),

  confirmTextQre: (sid: string, confirmed: Record<string, number>) =>
    request('POST', `/session/${sid}/confirm-text-qre`, { confirmed }),

  // ── Column review ─────────────────────────────────────────────────────────
  getColumns: (sid: string) =>
    request<any>('GET', `/session/${sid}/columns`),

  confirmColumns: (sid: string, confirmed: Record<string, string>, unavailable: string[]) =>
    request('POST', `/session/${sid}/columns/confirm`, { confirmed, unavailable }),

  // ── Configure ─────────────────────────────────────────────────────────────
  getConfigure: (sid: string) =>
    request<any>('GET', `/session/${sid}/configure`),

  saveConfigure: (
    sid: string,
    weightConfig: Record<string, number>,
    includeDims: Record<string, boolean>,
    kpiWeightConfig?: Record<string, number>,
  ) =>
    request('POST', `/session/${sid}/configure`, {
      weight_config: weightConfig,
      include_dims: includeDims,
      kpi_weight_config: kpiWeightConfig || {},
    }),

  // ── Run ───────────────────────────────────────────────────────────────────
  triggerRun: (sid: string) =>
    request('POST', `/session/${sid}/run`, {}),

  runStatusJson: (sid: string) =>
    request<{ status: string; pct: number; message: string }>(
      'GET', `/session/${sid}/run-status-json`
    ),

  // ── Results ───────────────────────────────────────────────────────────────
  getResults: (sid: string) =>
    request<any>('GET', `/session/${sid}/results`),

  getKpiDashboard: (sid: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any>('GET', `/session/${sid}/results/kpi-dashboard${qs}`)
  },

  getOrgRecommendation: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/org-recommendation`),

  getOrganogram: (sid: string, model: string, fte: number) =>
    request<any>('GET', `/session/${sid}/results/organogram?model=${model}&fte=${fte}`),

  getSwimlaneInteractive: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/swimlane-interactive`),

  getValueTree: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/value-tree`),

  getBuyingChannel: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/buying-channel`),

  getAiUsecases: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/ai-usecases`),

  // ── Formula review ────────────────────────────────────────────────────────
  getFormulaConfig: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/formula-config`),

  saveFormulaOverrides: (sid: string, overrides: any[]) =>
    request('POST', `/session/${sid}/results/formula-overrides`, { overrides }),

  clearFormulaOverrides: (sid: string) =>
    request('DELETE', `/session/${sid}/results/formula-overrides`),

  applyFormulaOverrides: (sid: string) =>
    request('POST', `/session/${sid}/results/apply-formula-overrides`, {}),

  getFormulaParams: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/formula-params`),

  saveFormulaParams: (sid: string, params: Record<string, any>) =>
    request('POST', `/session/${sid}/results/formula-params`, { params }),

  // ── AI ────────────────────────────────────────────────────────────────────
  generateAiInsights: (sid: string, forceRefresh = false) =>
    request('POST', `/session/${sid}/results/ai-insights`, { force_refresh: forceRefresh }),

  generateTabInsights: (sid: string, context: string, forceRefresh = false) =>
    request('POST', `/session/${sid}/results/ai-tab-insights`, { context, force_refresh: forceRefresh }),

  generateBuyingCategories: (sid: string) =>
    request('POST', `/session/${sid}/results/ai-buying-categories`, {}),

  getAiStatus: (sid: string) =>
    request<any>('GET', `/session/${sid}/results/ai-insights/status`),
}
```

---

## 17. CRITICAL RULES & GOTCHAS

```
1. BANKER'S ROUNDING: Python round(2.5) = 2, NOT 3. Use int(x + 0.5) everywhere.
   Frontend: Math.floor(x * factor + 0.5) / factor

2. SESSION ARCHITECTURE: 100% in-memory Python dict. Restart = all sessions lost.
   Frontend persists sessionId in localStorage via Zustand persist middleware.
   On /setup, always create a NEW session (api.createSession()) — never reuse stale ones.

3. RC ADOPTION: Counts POs where Outline_Agreement OR Contract_Number is non-empty.
   The combined "agreement" column is pre-computed in run.py before kpi_engine is called.
   rc_tat = 3 days (hardcoded world-class benchmark, NOT computed from data).

4. SCORE DISPLAY: 
   - score 0-4 float (raw)
   - score_display = rounded for UI (always show score_display, never score)
   - Thresholds: ≥3.5 = Leading, ≥2.5 = Advanced, ≥1.5 = Intermediate, else Foundation
   - null = "Insufficient Data" (grey badge)

5. KPI OVERRIDE: The run pipeline overrides kpi_engine actuals with kpi_dashboard values
   to ensure KPI Overview tab and Dashboard tab always show identical numbers.

6. COLUMN RESOLUTION: fuzzy match ≥0.92 → auto-resolve, 0.75-0.92 → suggestion,
   <0.75 → unmatched. PR-owned columns (pr_date, pr_number) are corrected post-resolution
   to prevent matching against PO dump columns.

7. DIMENSION 1.0 GUARD: If all KPIs score exactly 1.0 (likely missing columns → 0%),
   the dimension is marked "insufficient" not scored. fallback_score=null triggers this.

8. NUMBER FORMATTING: All monetary values in Indian Rupees (₹ Crore = 1e7 rupees).
   formatCr(value_in_rupees): divides by 1e7 to get crores.
   % KPIs: kpi_engine stores fractions (0.65), dashboard shows percent (65%).
   Formula override conversions: divide by 100 when saving % KPIs to benchmark.

9. GEMINI AUTH: Uses Application Default Credentials (ADC), NOT API keys.
   Run: gcloud auth application-default login
   Project: gen-lang-client-0226029743, Location: us-central1, Model: gemini-2.5-pro
   _model_tried flag prevents repeated failed init attempts within a session.

10. SSE STREAMING: /run-status endpoint streams SSE events. Frontend opens with fetch(),
    reads body.getReader(), decodes chunks, parses "data: {...}" lines.
    /run-status-json is a lightweight polling alternative (used in tests).
```
