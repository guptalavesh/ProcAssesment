# ProcAssesment

**Accenture Procurement Maturity Assessment** — AI-powered assessment platform that
ingests SAP procurement data, scores 8 KPIs across 5 buckets, and generates
Gemini-grounded transformation recommendations.

## Tech Stack

- **Backend:** FastAPI (Python 3.11+) on port 8002
- **Frontend:** Vite + React 18 + TypeScript on port 5173
- **Styling:** Tailwind CSS + Framer Motion + Lucide icons
- **AI:** Vertex AI Gemini 2.5 Pro (via `google-cloud-aiplatform`, ADC auth — no API keys)
- **Storage:** In-memory session store (Python dict, 4-hour TTL)
- **Streaming:** SSE for run progress updates

## Brand tokens

`#a100ff` (brand-purple) · `#460073` (brand-dark) · `#7500c0` (brand-mid)

## Quick start

### 1. Connect to Google Cloud / Vertex AI (free tier)

```bash
bash scripts/setup_gcp.sh
```

This will:
- Verify `gcloud` CLI is installed (and tell you how to install if not)
- Sign you in to Google Cloud (interactive browser flow)
- Pick or create a project
- Enable the Vertex AI API
- Set up Application Default Credentials (ADC)
- Write `backend/.env` with project + region
- Smoke-test the Gemini model

If you don't have a Google Cloud account yet, sign up at
[console.cloud.google.com](https://console.cloud.google.com) — Vertex AI Gemini
2.5 has a free tier suitable for development.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8002
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

### 4. Production build

```bash
cd frontend && npm run build
# Output → frontend/dist (served by FastAPI when present)
```

## Folder structure

```
ProcAssesment/
├── backend/
│   ├── main.py                  # FastAPI app entry
│   ├── config.py                # brand colours, score thresholds
│   ├── session_store.py         # in-memory session dict (4h TTL)
│   ├── serializers.py           # JSON safety for v1 engine objects
│   ├── routers/
│   │   ├── session.py           # session CRUD
│   │   ├── setup.py             # skills + engagement + QRE templates
│   │   ├── upload.py            # multi-file upload + column resolution
│   │   ├── column_review.py     # logical → actual column mapping
│   │   ├── configure.py         # KPI / dimension weights
│   │   ├── run.py               # 7-step pipeline + SSE progress
│   │   ├── results.py           # results endpoints
│   │   ├── kpi_dashboard.py     # 21-KPI computation
│   │   ├── ai_insights.py       # Vertex AI Gemini integration
│   │   ├── formula_review.py    # benchmark / parameter overrides
│   │   ├── ppt_export.py        # KPI deck + transformation proposal
│   │   └── file_inspect.py      # smart-upload column classifier
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── styles/globals.css
│       ├── store/assessmentStore.ts    # Zustand store
│       ├── lib/{api,types,utils}.ts
│       ├── pages/                       # 9 wizard pages
│       └── components/{layout,ui,results,upload}/
├── engine/                              # v1 engine stub (replace with full implementation)
└── scripts/setup_gcp.sh                 # one-shot GCP / Vertex AI setup
```

## Key concepts

- **8-KPI procurement model:** TAT, RC Adoption, Supplier OTD, Savings vs LPO, Spend per FTE, Defect Rate, Sourcing Tool Coverage, Single-Source PRs.
- **5 buckets:** Efficiency, Effectiveness, Vendor Management, Risk Management, Digitization.
- **Score scale (0–4):** Foundation → Intermediate → Advanced → Leading.
  - `≥3.5` Leading · `≥2.5` Advanced · `≥1.5` Intermediate · else Foundation
- **Banker's rounding fix:** Python `round(2.5) = 2`, not 3. The codebase uses
  `int(x + 0.5)` (or `Math.floor(x*factor + 0.5)/factor` in TS) to avoid this
  when computing displayed scores.

## Wizard flow

1. **Setup** → Client name, industry, skill selection
2. **Upload** → SAP exports (PO/PR/Invoice + optional sheets) with smart sheet-mapping
3. **Column Review** → Confirm logical-name → physical-column mapping
4. **Configure** → Adjust KPI weights and toggle dimensions
5. **Running** → Live SSE progress through the 7-step pipeline
6. **Formula Review** → Override benchmarks / multipliers / calculation parameters
7. **Results** → KPI Overview · Dashboard · Root Cause · Offerings (with PPT export)

## License

Internal use — Accenture engagements only.
