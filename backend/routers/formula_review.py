from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["formula_review"])


# ── Default 8-KPI formula catalogue ───────────────────────────────────────────
# NB: each entry here must include the keys the FormulaReviewPage expects:
#     bucket, weight, formula, benchmark_unit, thresholds (text strings) and
#     multipliers keyed score_4/3/2/1 (the page does `bench × m4` / `× m3`
#     to render the threshold cut-offs).
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
        "multipliers": {"score_4": 0.5,  "score_3": 0.75, "score_2": 1.0,  "score_1": 1.5},
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
        "multipliers": {"score_4": 1.0,  "score_3": 0.85, "score_2": 0.65, "score_1": 0.40},
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
        "multipliers": {"score_4": 1.0,  "score_3": 0.92, "score_2": 0.80, "score_1": 0.60},
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
        "multipliers": {"score_4": 1.5,  "score_3": 1.0,  "score_2": 0.5,  "score_1": 0.0},
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
        "multipliers": {"score_4": 2.0,  "score_3": 1.3,  "score_2": 0.8,  "score_1": 0.4},
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
        "multipliers": {"score_4": 0.5,  "score_3": 0.7,  "score_2": 1.0,  "score_1": 2.0},
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
        "multipliers": {"score_4": 0.5,  "score_3": 0.75, "score_2": 1.0,  "score_1": 1.5},
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
        "multipliers": {"score_4": 0.3,  "score_3": 0.7,  "score_2": 1.0,  "score_1": 2.0},
    },
}

BUCKET_ORDER: List[str] = ["Efficiency", "Effectiveness", "Vendor Management", "Risk"]

SCORE_LABELS: Dict[str, str] = {
    "1": "Foundation", "2": "Intermediate", "3": "Advanced", "4": "Leading",
}
SCORE_COLORS: Dict[str, str] = {
    "1": "#D92D20", "2": "#DC6803", "3": "#1570EF", "4": "#039855",
}


# ── Per-KPI computation parameters (FormulaParamGroup shape) ─────────────────
# Each entry is the FormulaParamGroup the frontend renders. ParamDef inside
# `params` mirrors the type the frontend expects: {key,type,label,unit?,
# min?,max?,step?,default,description,value}. The backend stores user-modified
# values in sess["formula_params"]; defaults sit here.
PARAM_GROUPS: Dict[str, Dict[str, Any]] = {
    "tat_pr_to_po": {
        "label":       "TAT outlier trimming",
        "description": "Discard the long tail of PR→PO TATs before averaging. Cleans out one-off stuck POs.",
        "params": [
            {"key": "outlier_trim_low",  "type": "number", "label": "Low percentile",  "unit": "%",
             "min": 0, "max": 25, "step": 1, "default": 5,
             "description": "Drop PRs with TAT below this percentile."},
            {"key": "outlier_trim_high", "type": "number", "label": "High percentile", "unit": "%",
             "min": 75, "max": 100, "step": 1, "default": 95,
             "description": "Drop PRs with TAT above this percentile."},
        ],
    },
    "supplier_otd": {
        "label":       "OTD grace period",
        "description": "Allow a buffer between requested delivery date and the GR posting before flagging late.",
        "params": [
            {"key": "grace_period_days", "type": "number", "label": "Grace period", "unit": "days",
             "min": 0, "max": 14, "step": 1, "default": 0,
             "description": "GR posted within this many days of requested delivery still counts as on-time."},
        ],
    },
    "savings_lpo": {
        "label":       "Savings vs LPO trimming",
        "description": "Trim the price-vs-LPO distribution before averaging. Prevents a few extreme rows from dominating the savings number.",
        "params": [
            {"key": "outlier_trim_low",  "type": "number", "label": "Low percentile",  "unit": "%",
             "min": 0, "max": 25, "step": 1, "default": 5,
             "description": "Drop savings observations below this percentile (deep discounts / promo SKUs)."},
            {"key": "outlier_trim_high", "type": "number", "label": "High percentile", "unit": "%",
             "min": 75, "max": 100, "step": 1, "default": 95,
             "description": "Drop savings observations above this percentile (data errors / unit changes)."},
            {"key": "include_zero_lpo",  "type": "boolean", "label": "Include rows with zero LPO",
             "default": False,
             "description": "Off by default — rows with no prior price reference can't be measured against LPO."},
        ],
    },
    "tail_spend_pct": {
        "label":       "Tail-spend threshold",
        "description": "What share of total spend qualifies a vendor as 'tail'.",
        "params": [
            {"key": "threshold_pct", "type": "number", "label": "Vendor share threshold", "unit": "%",
             "min": 0.1, "max": 5.0, "step": 0.1, "default": 1.0,
             "description": "Vendors below this share of total spend are counted in the tail."},
        ],
    },
    "emergency_prs": {
        "label":       "Emergency PR detection",
        "description": "Which PR_Type / Priority values count as 'emergency'.",
        "params": [
            {"key": "include_routine", "type": "boolean", "label": "Treat 'Routine' as emergency",
             "default": False,
             "description": "Off by default — only Emergency / Urgent / Rush types count."},
            {"key": "release_same_day", "type": "boolean", "label": "Treat same-day-released PRs as emergency",
             "default": True,
             "description": "PRs released on the same day they were created — usually unplanned."},
        ],
    },
    "pac_prs": {
        "label":       "Single-source detection",
        "description": "How aggressively to flag PRs as single-source / pre-assigned.",
        "params": [
            {"key": "vendor_field_required", "type": "boolean", "label": "Require Preferred_Vendor field",
             "default": True,
             "description": "When on, only PRs with Preferred_Vendor set count. Off uses a wider net (Fixed_Vendor / Vendor)."},
        ],
    },
    "rc_adoption_volume": {
        "label":       "RC coverage scope",
        "description": "Which agreement columns count as rate-contract coverage.",
        "params": [
            {"key": "include_outline_agreement", "type": "boolean", "label": "Include Outline_Agreement",
             "default": True,
             "description": "Standard SAP outline agreement / framework PO."},
            {"key": "include_contract_number",   "type": "boolean", "label": "Include Contract_Number",
             "default": True,
             "description": "Free-form contract reference column."},
        ],
    },
    "spend_per_fte": {
        "label":       "Spend / FTE basis",
        "description": "How total spend is rolled up before dividing by FTE count.",
        "params": [
            {"key": "exclude_capex", "type": "boolean", "label": "Exclude CapEx-flagged POs",
             "default": False,
             "description": "When on, POs marked CapEx (FO doc type) are dropped before the per-FTE divide."},
        ],
    },
}

# Legacy shape kept for any caller still touching it via the engine helper.
DEFAULT_PARAMS: Dict[str, Dict[str, Any]] = {
    kid: {p["key"]: p["default"] for p in group["params"]}
    for kid, group in PARAM_GROUPS.items()
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
    """Return computation parameters in the FormulaParamGroup shape the
    frontend expects: { formula_params: { kpi_id: { label, description,
    params[], has_override } } }. The page reads `paramsData.formula_params`
    directly and renders one editor per param entry."""
    sess = get_session(session_id)
    saved = sess.get("formula_params") or {}

    out: Dict[str, Dict[str, Any]] = {}
    for kid, group in PARAM_GROUPS.items():
        kpi_saved = saved.get(kid) or {}
        params_out: List[Dict[str, Any]] = []
        for p in group["params"]:
            value = kpi_saved.get(p["key"], p["default"])
            params_out.append({**p, "value": value})
        out[kid] = {
            "label":        group["label"],
            "description":  group["description"],
            "params":       params_out,
            "has_override": any(p["value"] != p["default"] for p in params_out),
        }
    return {"formula_params": out, "defaults": DEFAULT_PARAMS}


@router.post("/session/{session_id}/results/formula-params")
def save_formula_params(session_id: str, payload: FormulaParamsPayload):
    sess = get_session(session_id)
    sess["formula_params"] = payload.params
    return {"ok": True}
