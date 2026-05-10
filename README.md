# AIVault — Functional Maturity Assessment

AI-grounded procurement maturity assessment. Ingests SAP procurement extracts
(PO, PR, invoice, workforce), scores eight KPIs across four buckets, blends in
questionnaire and free-text inputs across thirteen dimensions, and surfaces an
overall maturity score with explanations and recommended actions.

## Tech Stack

- **Backend:** FastAPI (Python 3.11+) on port 8002
- **Frontend:** Vite + React 18 + TypeScript on port 5173
- **Styling:** Tailwind CSS — AIVault design system (cobalt accent, cool neutrals, Inter + IBM Plex Mono)
- **AI:** Vertex AI Gemini 2.5 Pro via `google-cloud-aiplatform` (ADC auth, no API keys)
- **Storage:** In-memory session store (Python dict, 4-hour TTL)
- **Streaming:** SSE for run progress updates

## Brand tokens

`#2251FF` (cobalt — single accent) · `#0F141C` (text-1) · `#F8F9FB` (canvas) · `#F1F4FF` (agent surface)

## Quick start — deploy to Google Cloud (recommended)

```bash
# In Google Cloud Shell (https://shell.cloud.google.com — gcloud + node + firebase preinstalled)
git clone https://github.com/guptalavesh/ProcAssesment.git
cd ProcAssesment
git checkout claude/build-app-from-specs-3FyO9
bash scripts/deploy_to_gcp.sh
```

The script will sign you in (if needed), pick or prompt for a project, enable
the required APIs, build the backend image with Cloud Build, deploy to Cloud
Run with a runtime service account that has `roles/aiplatform.user`, build the
React bundle, and push it to Firebase Hosting. Total wall time on a fresh
project: **8–12 minutes**.

You'll get two URLs:

- `https://<project>.web.app` — public app
- `https://procassesment-…-uc.a.run.app/health` — direct backend probe

Architecture: **Firebase Hosting** (CDN) for the React build + **Cloud Run**
(serverless containers, scales to zero) for FastAPI. Firebase rewrites
`/api/**` to Cloud Run so the browser only ever sees one origin. Both fully
managed — no VMs, no SSH, no servers to patch.

Common overrides:

```bash
PROJECT_ID=my-other-proj bash scripts/deploy_to_gcp.sh   # explicit project
ALWAYS_ON=1              bash scripts/deploy_to_gcp.sh   # min-instances=1 (~$5/mo)
SKIP_FRONTEND=1          bash scripts/deploy_to_gcp.sh   # backend only
SKIP_BACKEND=1           bash scripts/deploy_to_gcp.sh   # frontend only
REGION=europe-west1      bash scripts/deploy_to_gcp.sh
```

> **Why `--max-instances 1`?** Sessions live in a Python dict, so a user's
> second request must land on the same replica. Swap `backend/session_store.py`
> for a Firestore-backed store (one isolated change) to scale beyond one
> replica.

Full deploy walkthrough, troubleshooting and teardown:
**[docs/DEPLOY_TO_GCP.md](docs/DEPLOY_TO_GCP.md)**.

## Local development

### 1. Connect to Vertex AI (one-time)

```bash
bash scripts/setup_gcp.sh
```

Verifies `gcloud`, signs you in, picks or creates a project, enables Vertex AI,
configures Application Default Credentials, writes `backend/.env`, and smoke-
tests the Gemini model. New to Google Cloud? Sign up at
[console.cloud.google.com](https://console.cloud.google.com) — Vertex AI Gemini
2.5 has a free tier suitable for development. AI insights work without this
step too; the backend falls back to rule-based output when Vertex isn't
reachable.

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

Vite proxies `/api/**` to `http://localhost:8002`, so the dev server gives you
the same single-origin experience as production.

### 4. Production build (optional, served by FastAPI)

```bash
cd frontend && npm run build
# Output → frontend/dist (FastAPI mounts it automatically if present)
```

## Folder structure

```
ProcAssesment/
├── backend/
│   ├── main.py                # FastAPI app entry
│   ├── config.py              # score thresholds and labels
│   ├── session_store.py       # in-memory session dict (4h TTL)
│   ├── serializers.py         # JSON-safe envelope for engine objects
│   ├── routers/
│   │   ├── session.py         # session CRUD
│   │   ├── setup.py           # skills + engagement + QRE templates
│   │   ├── upload.py          # multi-file upload + column resolution
│   │   ├── column_review.py   # logical → actual column mapping
│   │   ├── configure.py       # KPI + dimension weights
│   │   ├── run.py             # 7-step pipeline with SSE progress
│   │   ├── results.py         # results, organogram, swimlane, value tree
│   │   ├── kpi_dashboard.py   # KPI drill-down helpers
│   │   ├── ai_insights.py     # Vertex AI Gemini integration
│   │   ├── formula_review.py  # benchmark / parameter overrides
│   │   ├── ppt_export.py      # KPI deck + transformation proposal
│   │   └── file_inspect.py    # smart-upload column classifier
│   └── requirements.txt
├── engine/                    # KPI / scoring engine
│   ├── skill_loader.py        # Skill + Dimension models, column aliases
│   ├── data_loader.py         # 10 file loaders + DataBundle + assemble_bundle
│   ├── column_resolver.py     # fuzzy column matching with per-source dispatch
│   ├── metrics.py             # per-dimension coverage preview
│   ├── text_qre_parser.py     # free-text → per-dimension scores
│   ├── kpi_engine.py          # 8 procurement KPIs + benchmarks + scoring ramp
│   ├── benchmark_loader.py    # industry-keyed benchmarks
│   ├── scorer.py              # dimension scoring + overall roll-up
│   ├── kpi_assessment.py      # KPI assessment + bucket roll-up
│   ├── report_builder.py      # 5-sheet xlsx export
│   ├── organogram.py          # Centralised / Hybrid / Decentralised HTML
│   └── qualitative_analyser.py# placeholder (production AI is in ai_insights)
├── frontend/
│   ├── index.html
│   ├── tailwind.config.ts     # AIVault tokens (cobalt accent, cool neutrals)
│   └── src/
│       ├── main.tsx · App.tsx
│       ├── styles/globals.css # AIVault component classes
│       ├── store/assessmentStore.ts
│       ├── lib/{api,types,utils}.ts
│       ├── pages/             # 9 wizard pages
│       └── components/{layout,ui,results,upload}/
├── Dockerfile                 # backend image for Cloud Run
├── firebase.json              # Hosting + /api/** rewrite to Cloud Run
└── scripts/
    ├── setup_gcp.sh           # one-shot ADC + Vertex AI bootstrap
    └── deploy_to_gcp.sh       # one-shot end-to-end deploy
```

## Key concepts

- **8-KPI procurement model:** PR-to-PO TAT · Rate-Contract Adoption · On-Time Delivery · Savings per LPO · 3-Way Match · Emergency PR Rate · Tail Spend Share · Spend Managed per FTE.
- **4 buckets:** Efficiency · Effectiveness · Vendor Management · Risk.
- **13 dimensions:** Strategy & Governance, Spend Visibility & Analytics, Category Management, Sourcing & Contracting, Supplier Management, Operational Procurement, Purchase-to-Pay Process, Risk & Compliance, Digital & Technology, People & Organisation, Sustainability, Value Delivery, Innovation.
- **Score scale (1.0 – 4.0):** Foundation → Intermediate → Advanced → Leading.
  - `≥ 3.5` Leading · `≥ 2.5` Advanced · `≥ 1.5` Intermediate · else Foundation
- **Score blending:** when both signals are present, a dimension scores at 60% weight from computed KPIs and 40% from the questionnaire. Free-text QRE confirmations override both. Bucket and overall scores are weighted averages.

## Wizard flow

1. **Setup** — client name, industry, skill, engagement metadata
2. **Upload** — SAP extracts (PO + optional PR / invoice / workforce / inventory / GR / production / maintenance) with sheet pickers and a free-text QRE field
3. **Column Review** — confirm logical-name → physical-column mapping; saves the map for future uploads from the same client
4. **Configure** — tune KPI weights, dimension weights, exclude dimensions
5. **Running** — live SSE progress through the 7-step pipeline
6. **Formula Review** — override benchmarks / multipliers / calculation parameters
7. **Results** — overall score, dimension breakdown, KPI dashboard, root-cause, AI insights, organogram, PPT / Excel export

## Sample data

`sample_data/` ships a deterministic, story-driven SAP fixture (600 POs / 720
PRs / 510 invoices / 45 FTE workforce, ~₹500 Cr annual spend, calibrated for
metals-and-mining). Drop the four xlsx files into the matching upload slots
and the wizard lands at ~1.85 (Intermediate) overall with rate-contract
coverage and spend-per-FTE as the headline gaps.

To regenerate: `python sample_data/generate_sample_data.py` (seeded).

## Verifying a deploy

After `bash scripts/deploy_to_gcp.sh`:

```bash
# Quick smoke
curl -sS https://<project>.web.app/health
curl -sS https://<project>.web.app/api/v1/skills

# Full end-to-end (40 checks across wizard + AI + exports)
BASE=https://<project>.web.app/api/v1 python scripts/smoke_test.py
```

The harness exits non-zero on any failure — fine to wire into CI.

## Custom domain (subdomain-only pattern)

The Firebase Hosting default URL is `https://<project>.web.app`. To serve
the app from your own domain, **add a subdomain only** — never the apex,
never a wildcard. That way one DNS zone (e.g. `lgai.in`) can host this
app on `proc.lgai.in`, a marketing site on `www.lgai.in`, an API on
`api.lgai.in`, etc., each independently, without one project's
configuration affecting the others.

### Setup

1. **Firebase Console** → Hosting on this project → **Add custom domain**
   → enter the full subdomain (e.g. `proc.lgai.in`). Don't tick any
   "include apex" / "redirect from root" option.
2. Firebase shows you a **TXT** record (ownership) and one or two **A**
   records (Firebase edge IPs). Copy them.
3. **At your DNS provider** for the parent zone (`lgai.in`):
   - Add the TXT record on the exact name Firebase requested
   - Add the A records on the subdomain label (`proc`)
   - **Don't** add anything on `@` (apex), don't add a wildcard `*`
   - TTL 300s while iterating
4. Wait ~15 min for SSL provisioning. The Firebase console flips to
   green when ready, then `https://proc.lgai.in/` serves the app.

### Why subdomain-only

DNS records are scoped to the exact label. `proc.lgai.in` records are
independent of every other label, so the apex and other subdomains
remain free for whatever else you want to host. Adding the apex or a
wildcard captures more than you intended and pins this Firebase project
to the entire zone — avoid both.

### Cloudflare-specific note

If you use Cloudflare for DNS, **keep the proxy off (grey cloud, not
orange)** for the Firebase records. Firebase issues its own TLS;
Cloudflare's proxy in front would conflict with the cert validation.

### Multiple apps on the same zone

For each new app on a new subdomain, repeat the above on that subdomain
only. Each Firebase / Vercel / Netlify project owns its label
independently. Apex stays untouched until you decide what to do with it.

## Caveats

- The KPI engine and scorer here are **pragmatic stubs** designed to drive the
  full UI flow on real or synthetic SAP data. They are not a production
  reference model — KPI definitions, benchmark values and scoring thresholds
  are reasonable approximations that can be replaced by dropping a richer
  engine into `engine/` (the import surface is documented in each module).
- Sessions are in-memory (`backend/session_store.py`). For multi-replica
  deployments, swap to Firestore.
- AI insights run on Vertex AI Gemini when the runtime service account is
  bound to `roles/aiplatform.user` (the deploy script does this). When Vertex
  is unreachable the routes fall through to a rule-based engine that mines
  the session's KPI / dimension data and produces the same per-context shape
  the React renderer expects — so the AI tab is never blank.

## License

Internal use only.
