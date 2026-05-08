"""End-to-end smoke test for the AIVault assessment backend.

Walks the full wizard with sample_data/ and exercises every results / AI /
export endpoint, printing a ✓/✗ table at the end. Exits with non-zero if
any check fails.

Usage:
    # Local backend (port 8002)
    python scripts/smoke_test.py

    # Cloud Run / Firebase Hosting target
    BASE=https://logitransform-ai.web.app/api/v1 python scripts/smoke_test.py

The harness is intentionally dependency-light — it only needs `requests`,
which is already a transitive dep of the backend test stack.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

BASE   = os.environ.get("BASE", "http://localhost:8002/api/v1")
SAMPLE = Path(__file__).resolve().parent.parent / "sample_data"

results: list[tuple[str, bool, str]] = []


def step(name: str):
    print(f"\n── {name} " + "─" * max(0, 60 - len(name)))


def record(name: str, ok: bool, detail: str = ""):
    icon = "✓" if ok else "✗"
    print(f"  {icon} {name}{(': ' + detail) if detail else ''}")
    results.append((name, bool(ok), detail))


def post(path, **kw):
    return requests.post(f"{BASE}{path}", timeout=120, **kw)


def get(path, **kw):
    return requests.get(f"{BASE}{path}", timeout=120, **kw)


# ── 1. Session
step("1. Create session")
r = post("/session"); r.raise_for_status()
sid = r.json()["session_id"]
record("create session", True, sid)

# ── 2. Setup
step("2. Setup")
r = post(f"/session/{sid}/setup", json={
    "client_name":      "Demo Steel Works",
    "industry":         "Metals & Mining",
    "assessment_type":  "Baseline",
    "date":             time.strftime("%Y-%m-%d"),
    "assessor_name":    "AIVault smoke test",
    "notes":            "automated harness against sample_data/",
    "skill_path":       "procurement_maturity_baseline",
    "fte_count":        45,
    "annual_spend":     500.0,
    "annual_revenue":   2500.0,
}); r.raise_for_status()
record("setup ok", r.json().get("ok") is True, json.dumps(r.json()))

# ── 3. Upload sample data
step("3. Upload sample SAP files")
files = {
    "po_file":        ("sap_po_dump.xlsx",      open(SAMPLE / "sap_po_dump.xlsx", "rb"),
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "pr_file":        ("sap_pr_dump.xlsx",      open(SAMPLE / "sap_pr_dump.xlsx", "rb"),
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "invoice_file":   ("sap_invoice_dump.xlsx", open(SAMPLE / "sap_invoice_dump.xlsx", "rb"),
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "workforce_file": ("sap_workforce.xlsx",    open(SAMPLE / "sap_workforce.xlsx", "rb"),
                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
}
r = post(f"/session/{sid}/upload", files=files); r.raise_for_status()
upload_resp = r.json()
fr = upload_resp.get("files") or {}
record("po loaded",        fr.get("po", {}).get("ok"),       f"{fr.get('po', {}).get('rows')} rows")
record("pr loaded",        fr.get("pr", {}).get("ok"),       f"{fr.get('pr', {}).get('rows')} rows")
record("invoice loaded",   fr.get("invoice", {}).get("ok"),  f"{fr.get('invoice', {}).get('rows')} rows")
record("workforce loaded", fr.get("workforce", {}).get("ok"),f"{fr.get('workforce', {}).get('rows')} rows")
record("coverage preview", isinstance(upload_resp.get("coverage"), dict) and len(upload_resp["coverage"]) > 0)

# ── 4. Column review (auto-confirm)
step("4. Column review")
if upload_resp.get("needs_column_review"):
    state = get(f"/session/{sid}/columns").json()
    confirmed = {l: s["suggested"] for l, s in (state.get("suggestions") or {}).items()}
    r = post(f"/session/{sid}/columns/confirm",
             json={"confirmed": confirmed, "unavailable": state.get("unmatched") or []})
    r.raise_for_status()
    record("columns confirmed", True,
           f"{len(state.get('resolved') or {})} resolved, {len(confirmed)} auto-accepted")
else:
    record("columns auto-resolved", True, "no review needed")

# ── 5. Configure
step("5. Configure")
cfg = get(f"/session/{sid}/configure").json()
record("is_procurement",  cfg.get("is_procurement") is True)
record("buckets present", len(cfg.get("buckets") or {}) >= 4)
data_ready = cfg.get("data_ready") or {}
record("kpis data-ready", all(data_ready.values()) if data_ready else False,
       f"{sum(data_ready.values())}/{len(data_ready)} KPIs")
r = post(f"/session/{sid}/configure", json={
    "weight_config": {d['dim_id']: d['weight'] for d in cfg['dimensions']},
    "include_dims":  {d['dim_id']: True       for d in cfg['dimensions']},
})
record("save configure", r.json().get("ok") is True)

# ── 6. Run
step("6. Run pipeline")
post(f"/session/{sid}/run").raise_for_status()
deadline = time.time() + 60
last = None
while time.time() < deadline:
    last = get(f"/session/{sid}/run-status-json").json()
    if last.get("status") in ("done", "error"):
        break
    time.sleep(0.4)
record("pipeline done", last and last.get("status") == "done", str(last))

# ── 7. Core results
step("7. Core results")
res = get(f"/session/{sid}/results").json()
overall = res.get("overall") or {}
record("overall.score",       overall.get("score") is not None, f"{overall.get('score')} ({overall.get('level')})")
record("dimension_results",   len(res.get("dimension_results") or []) == 13)
ka = res.get("kpi_assessment") or {}
record("kpi_assessment",      ka.get("overall_score") is not None, f"score={ka.get('overall_score')}")
record("buckets in assessment", len(ka.get("bucket_results") or {}) >= 4,
       f"{len(ka.get('bucket_results') or {})} buckets")
record("kpi_results count",   len(ka.get("kpi_results") or {}) == 8)

# ── 8. KPI dashboard
step("8. KPI dashboard")
dash = get(f"/session/{sid}/results/kpi-dashboard").json()
record("dashboard kpis",      len(dash.get("kpis") or {}) >= 7)
summary = dash.get("summary") or {}
record("summary spend",       summary.get("total_spend_cr", 0) > 0, f"₹{summary.get('total_spend_cr')} Cr")

# ── 9. Organogram
step("9. Organogram")
r = get(f"/session/{sid}/results/organogram?model=Hybrid&fte=45")
record("organogram html",     len(r.json().get("html", "")) > 500)

# ── 10. Swimlane
step("10. Swimlane")
html = get(f"/session/{sid}/results/swimlane").json().get("html", "")
record("swimlane html",       len(html) > 200)
record("swimlane cobalt",     "#2251FF" in html)
record("swimlane no purple",  "#460073" not in html)

# ── 11. Org recommendation + buying channel + value tree
step("11. Org / buying / value-tree")
rec = get(f"/session/{sid}/results/org-recommendation").json()
record("org recommendation", rec.get("model") in ("Centralised", "Hybrid", "Decentralised"))
bc = get(f"/session/{sid}/results/buying-channel").json()
record("buying channel rows", len(bc.get("rows") or []) > 0)
vt = get(f"/session/{sid}/results/value-tree").json()
record("value tree complete", vt.get("asis", {}).get("weighted_tat") is not None
                            and vt.get("tobe", {}).get("weighted_tat") is not None)

# ── 12. AI use cases
step("12. AI use cases")
record("AI use cases listed", len(get(f"/session/{sid}/results/ai-usecases").json().get("use_cases") or []) >= 6)

# ── 13. AI insights
step("13. AI insights")
status = get(f"/session/{sid}/results/ai-insights/status").json()
record("vertex availability flag in status", "vertex_available" in status,
       f"vertex_available={status.get('vertex_available')}")
ai = post(f"/session/{sid}/results/ai-insights", json={"force_refresh": True}).json()
record("ai summary",      bool(ai.get("summary")))
record("ai gaps",         len(ai.get("gaps") or []) > 0)
record("ai priorities",   len(ai.get("priorities") or []) > 0)
record("ai cards",        len(ai.get("insight_cards") or []) > 0)
print(f"      summary: {(ai.get('summary') or '')[:140]}")

# ── 14. Tab insights × 3 — verify the per-context shape AiInsightsMini renders
step("14. Tab insights (per-context shape)")
def _check_shape(ctx, j) -> tuple[bool, str]:
    if ctx == "kpi_overview":
        ok = bool(j.get("headline")) and isinstance(j.get("urgent_gaps"), list)
        return ok, f"headline+{len(j.get('urgent_gaps') or [])} gaps+{len(j.get('top_performers') or [])} top"
    if ctx == "rca":
        ok = bool(j.get("rca_summary")) and isinstance(j.get("root_causes"), list)
        return ok, f"rca_summary+{len(j.get('root_causes') or [])} causes"
    if ctx == "offerings":
        ok = bool(j.get("recommendation_summary")) and isinstance(j.get("top_offerings"), list)
        return ok, f"summary+{len(j.get('top_offerings') or [])} offerings"
    return False, "unknown context"
for ctx in ("kpi_overview", "rca", "offerings"):
    j = post(f"/session/{sid}/results/ai-tab-insights",
             json={"context": ctx, "force_refresh": True}).json()
    ok, detail = _check_shape(ctx, j)
    record(f"tab {ctx} shape", ok, f"source={j.get('source')} · {detail}")

# ── 15. Buying categories
step("15. Buying categories")
record("buying-categories endpoint", post(f"/session/{sid}/results/ai-buying-categories").status_code == 200)

# ── 16. Excel report
step("16. Excel report")
r = get(f"/session/{sid}/results/report")
record("xlsx response",
       r.headers.get("content-type", "").startswith("application/vnd.openxmlformats")
       and len(r.content) > 1000,
       f"{len(r.content)} bytes")

# ── 17. PPT exports
step("17. PPT exports")
for path, name in (("/results/export/ppt", "kpi-dashboard PPT"),
                   ("/results/export/ppt/proposal", "transformation-proposal PPT")):
    try:
        r = get(f"/session/{sid}{path}")
        record(name, r.status_code == 200 and len(r.content) > 5000,
               f"status={r.status_code} bytes={len(r.content)}")
    except Exception as e:
        record(name, False, f"error={e}")

# ── Summary
print("\n" + "═" * 70)
total = len(results)
ok = sum(1 for _, ok, _ in results if ok)
print(f" Result: {ok}/{total} checks passed")
if ok != total:
    print("\n Failures:")
    for name, passed, detail in results:
        if not passed:
            print(f"   ✗ {name}: {detail}")
print("═" * 70)
sys.exit(0 if ok == total else 1)
