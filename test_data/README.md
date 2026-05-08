# FY26 Chemical-Industry Test Dataset

A deterministic test fixture that drives the AIVault wizard with mid-size
Indian chemical-manufacturer data covering **FY26 (Apr 2025 → Mar 2026)**.

## Files

| File                       | Rows | What it represents |
| -------------------------- | ---- | ------------------ |
| `chem_po_dump.xlsx`        | 800  | Purchase orders — 8 plants, 80 vendors, 10 material groups, FY26 |
| `chem_pr_dump.xlsx`        | 950  | Purchase requisitions — supersets the POs (some PRs not converted) |
| `chem_invoice_dump.xlsx`   | 704  | Invoices keyed to ~88% of POs |
| `chem_workforce.xlsx`      | 100  | Procurement org — 100 FTE, Buyer → CPO ladder |
| `generate_test_data.py`    | —    | Deterministic generator (seed 26). Re-run to regenerate. |

## Story baked into the data

Calibrated for a **mid-size Indian chemical manufacturer, ~₹1,800 Cr annual
spend, 100 procurement FTE, 8 plants** across Gujarat / Maharashtra / Tamil
Nadu / AP / Telangana.

| KPI                      | Actual    | Benchmark | Score        | Reads as |
| ------------------------ | --------- | --------- | ------------ | -------- |
| PR-to-PO TAT             | ~14 days  | 9 days    | Foundation   | **Gap** — slow approvals |
| Rate-contract adoption   | ~56%      | 65%       | Intermediate | Mixed — strong on commodities, weak on specialty |
| On-time delivery         | ~85%      | 85%       | Intermediate | At benchmark |
| Savings vs LPO           | ~3%       | 5%        | Foundation   | **Gap** — savings leakage |
| 3-way match              | ~92%      | 90%       | Advanced     | **Strength** |
| Emergency PR rate        | ~17%      | 10%       | Foundation   | **Gap** — process upsets |
| Tail spend share         | ~21%      | 20%       | Intermediate | At benchmark |
| Spend managed per FTE    | ~₹16.5 Cr | ₹18 Cr    | Intermediate | Slight gap |

**Expected overall maturity: ~1.7 (Intermediate)**, with TAT, savings and
emergency PRs as the headline gaps. AI insights should call out
catalog-buying for indirect categories, demand-planning for emergency drivers,
and savings validation at PO commit.

## How to use

### Through the UI

1. Open `https://logitransform-ai.web.app/` (or your local dev server).
2. **Setup** — pick "Procurement Maturity — Baseline":
   - Industry: **Chemicals**
   - Assessment type: **Baseline**
   - Date: **2026-03-31**
   - FTE count: **100**
   - Annual spend: **₹1,800 Cr**
   - Annual revenue: **₹4,500 Cr** (optional)
3. **Upload** — drop the four xlsx files into the matching slots:
   - `chem_po_dump.xlsx`     → PO
   - `chem_pr_dump.xlsx`     → PR
   - `chem_invoice_dump.xlsx`→ Invoice
   - `chem_workforce.xlsx`   → Workforce
4. **Column review** — accept all auto-suggestions (clean SAP-style headers).
5. **Configure** — leave default weights, all 8 KPIs will be data-ready.
6. **Run** — pipeline finishes in <2s on local, ~3-5s on Cloud Run.
7. **Results** — overall score around **1.7**, all four KPI buckets
   populated with actual values, AI insights tabs render with Gemini-
   grounded narrative on the deployed app.

### Regenerating

```bash
python test_data/generate_test_data.py     # seeded — reproduces byte-for-byte
```

Tweak ranges, vendor counts or RC coverage at the top of the file and rerun.

## Vendor and category catalogue

**Plants** — Vapi, Dahej, Ankleshwar, Manali, Visakhapatnam, Vadodara,
Jamnagar, Hyderabad.

**Strategic vendors (top 10)** — BASF India, Reliance Industries, Tata
Chemicals, SRF, Aarti Industries, Solvay Asia Pacific, Indian Oil, Linde
India, Atul, PI Industries.

**Material groups** — bulk chemicals, intermediates, solvents, catalysts,
packaging (drums/IBCs), engineering spares, lab supplies, industrial gases,
MRO, freight & warehousing.

## Difference vs `sample_data/`

| Aspect            | `sample_data/` (steel) | `test_data/` (chemicals)   |
| ----------------- | ---------------------- | -------------------------- |
| Industry          | Metals & Mining        | Chemicals                  |
| Period            | 18-month rolling       | FY26 (Apr 2025 – Mar 2026) |
| Annual spend      | ~₹500 Cr               | ~₹1,800 Cr                 |
| FTE               | 45                     | 100                        |
| Plants            | 6                      | 8                          |
| Vendors           | 60                     | 80                         |
| Material groups   | 8                      | 10                         |
| RC coverage       | ~18%                   | ~56%                       |
| Overall expected  | ~1.85                  | ~1.70                      |
| Story             | Steelco needs RC push  | Chemco needs catalogue + demand planning |
