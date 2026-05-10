# Sample SAP Procurement Dataset

A deterministic, story-driven dataset for end-to-end testing of the AIVault
procurement-maturity wizard.

## Files

| File                       | Rows  | What it represents |
| -------------------------- | ----- | ------------------ |
| `sap_po_dump.xlsx`         | 600   | Purchase orders — 6 plants, 60 vendors, 8 material groups, 18 months |
| `sap_pr_dump.xlsx`         | 720   | Purchase requisitions — supersets the POs (some PRs not converted) |
| `sap_invoice_dump.xlsx`    | 510   | Invoices keyed to ~85% of POs — mostly within payment terms |
| `sap_workforce.xlsx`       | 45    | Procurement org of 45 FTE across roles (Buyer → CPO) |
| `generate_sample_data.py`  | —     | Deterministic generator (seed 42). Re-run to regenerate. |

## Story baked into the data

Calibrated for an **Indian metals-and-mining engagement, ~₹500 Cr annual spend, 45 FTE**.

| KPI                          | Actual         | Benchmark | Reads as |
| ---------------------------- | -------------- | --------- | -------- |
| PR-to-PO TAT                 | ~9 days        | 9 days    | **Strength** — Advanced |
| Rate-contract adoption (vol) | ~18%           | 65%       | **Gap** — Foundation |
| On-time delivery             | ~89%           | 85%       | **Strength** — Advanced |
| Savings vs LPO               | low single-digit | 5%      | **Mixed** — Intermediate |
| 3-way match                  | ~95%           | 90%       | **Strength** — Advanced |
| Emergency PRs                | ~12%           | 10%       | **Slight gap** — Intermediate |
| Tail spend (vendors <1%)     | ~22%           | 20%       | **Slight gap** — Intermediate |
| Spend managed per FTE        | ~₹11 Cr        | ₹18 Cr    | **Gap** — Intermediate |

The result for "Demo Steel Works" should land around **1.85–2.05 (Intermediate)**
overall maturity, with RC coverage and spend-per-FTE driving the biggest gaps
and the priority-action set focused on rate-contract expansion + tail-vendor
consolidation.

## How to use

### Through the UI

1. Open `https://logitransform-ai.web.app/` (or `http://localhost:5173/` in dev).
2. **Setup** — pick "Procurement Maturity — Baseline", set FTE 45 and Annual
   Spend ₹500 Cr.
3. **Upload** — drop the four xlsx files into the matching slots:
   `sap_po_dump.xlsx` → PO, `sap_pr_dump.xlsx` → PR,
   `sap_invoice_dump.xlsx` → Invoice, `sap_workforce.xlsx` → Workforce.
4. **Column review** — accept all auto-suggestions (the headers match
   AIVault's logical names cleanly).
5. **Configure** — leave default weights, all KPIs will be data-ready.
6. **Run** — pipeline finishes in <2s on local, ~5s on Cloud Run.
7. **Results** — overall score around **1.85**, four buckets populated,
   organogram + swimlane + value-tree + AI insights all render.

### From a script

```bash
python sample_data/generate_sample_data.py     # regenerate (seed 42)

# Drive the API end-to-end
python /tmp/e2e_full.py                         # if you've kept the harness
```

### Regenerating

`generate_sample_data.py` is seeded so it reproduces byte-for-byte. Tweak
ranges or vendor / material counts at the top of the file and re-run.

## What was verified against this dataset

The harness `e2e_full.py` exercises 44 checks against a running backend:

- Session lifecycle (create, setup)
- All four uploaders (PO, PR, Invoice, Workforce)
- Coverage preview, column resolver, column confirm
- Configure (procurement detection, 4 buckets, 8 KPIs data-ready)
- Run pipeline to "done"
- Core results: overall score, 13 dimension results, KPI assessment, buckets
- KPI dashboard (8 KPIs + Pareto + spend summary)
- Organogram (Centralised / Hybrid / Decentralised)
- Swimlane HTML (cobalt-branded, no Accenture purple)
- Org recommendation, buying-channel classifier, value tree
- AI use cases (6 prebuilt)
- AI insights status (Vertex availability flag)
- AI insights main + 3 tab contexts (kpi_overview, rca, offerings) — uses
  Vertex on Cloud Run, falls through to the rule-based engine on local /
  if Vertex throws
- AI buying-categories (Vertex-only, returns empty cleanly without)
- Excel report download (multi-sheet xlsx)
- KPI-dashboard PPT export (~13 slides) and Transformation-proposal PPT
  (~18 slides) — both AIVault-branded

All 44 checks green on commit `cf34b3a` + the engine + AI fallback work.
