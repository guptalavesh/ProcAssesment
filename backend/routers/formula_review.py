from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["formula_review"])


# ── Default 8-KPI formula catalogue ───────────────────────────────────────────
# NB: each entry here must include the keys the FormulaReviewPage expects:
#     bucket, weight, formula, benchmark_unit, thresholds — the page derives
#     the bucket grouping + threshold display directly from this payload.
KPI_FORMULAS = {
    "tat_pr_to_po": {
        "label": "PR-to-PO TAT", "unit": "days", "bucket": "Efficiency", "weight": 0.15,
        "default_benchmark": 9, "direction": "lower_is_better",
        "description": "Average days between PR creation and PO issuance.",
        "formula": "mean( po_date - pr_release_date ) — trimmed at P5/P95",
        "benchmark_unit": "days",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≤ 0.5 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≤ 0.75 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≤ 1.0 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "> 1.5 × benchmark"},
        },
        "multipliers": {"leading": 0.5, "advanced": 0.75, "intermediate": 1.0, "foundation": 1.5},
    },
    "rc_adoption_volume": {
        "label": "RC Adoption (Volume)", "unit": "%", "bucket": "Effectiveness", "weight": 0.18,
        "default_benchmark": 65, "direction": "higher_is_better",
        "description": "% of POs covered by Rate Contracts / Outline Agreements (by count).",
        "formula": "count( PO with agreement ) / count( PO ) × 100",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≥ 1.0 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≥ 0.85 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≥ 0.65 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "< 0.40 × benchmark"},
        },
        "multipliers": {"leading": 1.0, "advanced": 0.85, "intermediate": 0.65, "foundation": 0.40},
    },
    "supplier_otd": {
        "label": "Supplier On-Time Delivery", "unit": "%", "bucket": "Vendor Management", "weight": 0.12,
        "default_benchmark": 85, "direction": "higher_is_better",
        "description": "% of GR dates within delivery window (with grace period).",
        "formula": "count( gr_date ≤ delivery_date + grace ) / count( PO with GR ) × 100",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≥ 1.00 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≥ 0.92 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≥ 0.80 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "< 0.60 × benchmark"},
        },
        "multipliers": {"leading": 1.0, "advanced": 0.92, "intermediate": 0.80, "foundation": 0.60},
    },
    "savings_lpo": {
        "label": "Savings vs Last PO Price", "unit": "%", "bucket": "Effectiveness", "weight": 0.12,
        "default_benchmark": 5, "direction": "higher_is_better",
        "description": "Average savings achieved against last PO price for the same material.",
        "formula": "mean( ( lpo_price − net_price ) / lpo_price × 100 ) — trimmed at P5/P95",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≥ 1.5 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≥ 1.0 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≥ 0.5 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "< 0.0 × benchmark"},
        },
        "multipliers": {"leading": 1.5, "advanced": 1.0, "intermediate": 0.5, "foundation": 0.0},
    },
    "spend_per_fte": {
        "label": "Spend per FTE", "unit": "₹ Cr", "bucket": "Effectiveness", "weight": 0.10,
        "default_benchmark": 18, "direction": "higher_is_better",
        "description": "Total annual spend divided by procurement FTE count.",
        "formula": "sum( PO net_value ) / fte_count / 1e7",
        "benchmark_unit": "₹ Cr",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≥ 2.0 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≥ 1.3 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≥ 0.8 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "< 0.4 × benchmark"},
        },
        "multipliers": {"leading": 2.0, "advanced": 1.3, "intermediate": 0.8, "foundation": 0.4},
    },
    "emergency_prs": {
        "label": "Emergency PRs", "unit": "%", "bucket": "Risk", "weight": 0.10,
        "default_benchmark": 10, "direction": "lower_is_better",
        "description": "% of PRs marked emergency / urgent (process upsets, stock-outs).",
        "formula": "count( PR_Type ∈ {Emergency, Urgent} ) / count( PR ) × 100",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≤ 0.5 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≤ 0.7 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≤ 1.0 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "> 2.0 × benchmark"},
        },
        "multipliers": {"leading": 0.5, "advanced": 0.7, "intermediate": 1.0, "foundation": 2.0},
    },
    "tail_spend_pct": {
        "label": "Tail Spend %", "unit": "%", "bucket": "Effectiveness", "weight": 0.08,
        "default_benchmark": 20, "direction": "lower_is_better",
        "description": "% of total spend with vendors below 1% individual share.",
        "formula": "sum( spend on vendors with share < 1% ) / sum( total spend ) × 100",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≤ 0.5 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≤ 0.75 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≤ 1.0 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "> 1.5 × benchmark"},
        },
        "multipliers": {"leading": 0.5, "advanced": 0.75, "intermediate": 1.0, "foundation": 1.5},
    },
    "pac_prs": {
        "label": "Single-Source / PAC PRs", "unit": "%", "bucket": "Risk", "weight": 0.10,
        "default_benchmark": 5, "direction": "lower_is_better",
        "description": "% of PRs raised with a pre-assigned vendor (single-source).",
        "formula": "count( PR with Preferred_Vendor set ) / count( PR ) × 100",
        "benchmark_unit": "%",
        "thresholds": {
            "leading":      {"label": "Leading",      "condition": "≤ 0.3 × benchmark"},
            "advanced":     {"label": "Advanced",     "condition": "≤ 0.7 × benchmark"},
            "intermediate": {"label": "Intermediate", "condition": "≤ 1.0 × benchmark"},
            "foundation":   {"label": "Foundation",   "condition": "> 2.0 × benchmark"},
        },
        "multipliers": {"leading": 0.3, "advanced": 0.7, "intermediate": 1.0, "foundation": 2.0},
    },
}

BUCKET_ORDER: List[str] = ["Efficiency", "Effectiveness", "Vendor Management", "Risk"]

SCORE_LABELS: Dict[str, str] = {
    "1": "Foundation", "2": "Intermediate", "3": "Advanced", "4": "Leading",
}
SCORE_COLORS: Dict[str, str] = {
    "1": "#D92D20", "2": "#DC6803", "3": "#1570EF", "4": "#039855",
}

DEFAULT_PARAMS = {
    "tat_pr_to_po":    {"outlier_trim_low": 5, "outlier_trim_high": 95},
    "supplier_otd":    {"grace_period_days": 0},
    "tail_spend_pct":  {"threshold_pct": 1.0},
}


class FormulaOverridePayload(BaseModel):
    overrides: List[Dict[str, Any]]  # [{kpi_id, benchmark, multipliers}]


class FormulaParamsPayload(BaseModel):
    params: Dict[str, Dict[str, Any]]  # {kpi_id: {param_key: value}}


@router.get("/session/{session_id}/results/formula-config")
def get_formula_config(session_id: str):
    """Return the full formula catalogue in the shape FormulaReviewPage expects.

    The frontend reads `kpis[]` (each with bucket, weight, formula,
    benchmark, thresholds, multipliers, has_override) and groups by
    `bucket_order`. It also uses `score_labels` / `score_colors` for the
    threshold legend and `overrides_active` / `override_count` for the
    summary banner.
    """
    sess = get_session(session_id)
    overrides = sess.get("formula_overrides") or {}
    kpis: List[Dict[str, Any]] = []
    for kid, meta in KPI_FORMULAS.items():
        ovr = overrides.get(kid, {})
        kpis.append({
            "kpi_id":         kid,
            "label":          meta["label"],
            "bucket":         meta["bucket"],
            "weight":         meta["weight"],
            "unit":           meta["unit"],
            "direction":      meta["direction"],
            "formula":        meta["formula"],
            "description":    meta["description"],
            "benchmark":      ovr.get("benchmark", meta["default_benchmark"]),
            "benchmark_unit": meta["benchmark_unit"],
            "thresholds":     meta["thresholds"],
            "multipliers":    ovr.get("multipliers", meta["multipliers"]),
            "has_override":   bool(ovr),
        })
    return {
        "kpis":             kpis,
        "score_labels":     SCORE_LABELS,
        "score_colors":     SCORE_COLORS,
        "bucket_order":     BUCKET_ORDER,
        "overrides_active": bool(overrides),
        "override_count":   len(overrides),
    }


@router.post("/session/{session_id}/results/formula-overrides")
def save_formula_overrides(session_id: str, payload: FormulaOverridePayload):
    sess = get_session(session_id)
    overrides = sess.get("formula_overrides") or {}
    for entry in payload.overrides:
        kid = entry.get("kpi_id")
        if not kid: continue
        overrides[kid] = {
            "benchmark": entry.get("benchmark"),
            "multipliers": entry.get("multipliers") or {},
        }
    sess["formula_overrides"] = overrides
    return {"ok": True, "count": len(overrides)}


@router.delete("/session/{session_id}/results/formula-overrides")
def clear_formula_overrides(session_id: str):
    sess = get_session(session_id)
    sess["formula_overrides"] = {}
    return {"ok": True}


@router.post("/session/{session_id}/results/apply-formula-overrides")
def apply_formula_overrides(session_id: str):
    sess = get_session(session_id)
    kpi_assessment = sess.get("kpi_assessment")
    if kpi_assessment is None:
        raise HTTPException(status_code=400, detail="No KPI assessment available — run pipeline first.")
    overrides = sess.get("formula_overrides") or {}
    kpi_results = getattr(kpi_assessment, "kpi_results", {}) or {}
    for kid, kr in kpi_results.items():
        ovr = overrides.get(kid)
        if not ovr: continue
        new_bench = ovr.get("benchmark")
        if new_bench is not None:
            try: kr.benchmark = float(new_bench)
            except Exception: pass
    return {"ok": True, "applied": len(overrides)}


@router.get("/session/{session_id}/results/formula-params")
def get_formula_params(session_id: str):
    sess = get_session(session_id)
    saved = sess.get("formula_params") or {}
    out = {}
    for kid, defaults in DEFAULT_PARAMS.items():
        merged = dict(defaults)
        merged.update(saved.get(kid) or {})
        out[kid] = merged
    return {"params": out, "defaults": DEFAULT_PARAMS}


@router.post("/session/{session_id}/results/formula-params")
def save_formula_params(session_id: str, payload: FormulaParamsPayload):
    sess = get_session(session_id)
    sess["formula_params"] = payload.params
    return {"ok": True}
