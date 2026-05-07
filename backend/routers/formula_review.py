from __future__ import annotations
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["formula_review"])


# ── Default 8-KPI formula catalogue ───────────────────────────────────────────
KPI_FORMULAS = {
    "tat_pr_to_po": {
        "label": "PR-to-PO TAT", "unit": "days",
        "default_benchmark": 45, "direction": "lower_is_better",
        "description": "Average days between PR creation and PO issuance.",
        "multipliers": {"leading": 0.5, "advanced": 0.75, "intermediate": 1.0, "foundation": 1.5},
    },
    "rc_adoption_volume": {
        "label": "RC Adoption (Volume)", "unit": "%",
        "default_benchmark": 80, "direction": "higher_is_better",
        "description": "% of POs covered by Rate Contracts / Outline Agreements (by count).",
        "multipliers": {"leading": 1.0, "advanced": 0.85, "intermediate": 0.65, "foundation": 0.40},
    },
    "supplier_otd": {
        "label": "Supplier On-Time Delivery", "unit": "%",
        "default_benchmark": 91, "direction": "higher_is_better",
        "description": "% of GR dates within delivery window (with grace period).",
        "multipliers": {"leading": 1.0, "advanced": 0.92, "intermediate": 0.80, "foundation": 0.60},
    },
    "savings_lpo": {
        "label": "Savings vs Last PO Price", "unit": "%",
        "default_benchmark": 5, "direction": "higher_is_better",
        "description": "Average savings achieved against last PO price for the same material.",
        "multipliers": {"leading": 1.5, "advanced": 1.0, "intermediate": 0.5, "foundation": 0.0},
    },
    "spend_per_fte": {
        "label": "Spend per FTE", "unit": "₹ Cr",
        "default_benchmark": 15, "direction": "higher_is_better",
        "description": "Total annual spend divided by procurement FTE count.",
        "multipliers": {"leading": 2.0, "advanced": 1.3, "intermediate": 0.8, "foundation": 0.4},
    },
    "defect_rate": {
        "label": "Quality Defect Rate", "unit": "%",
        "default_benchmark": 2.5, "direction": "lower_is_better",
        "description": "% of supplied goods rejected at incoming quality.",
        "multipliers": {"leading": 0.4, "advanced": 0.7, "intermediate": 1.0, "foundation": 1.6},
    },
    "sourcing_coverage": {
        "label": "Sourcing Tool Coverage", "unit": "%",
        "default_benchmark": 80, "direction": "higher_is_better",
        "description": "% of POs sourced via e-sourcing or auction tools.",
        "multipliers": {"leading": 1.0, "advanced": 0.80, "intermediate": 0.60, "foundation": 0.30},
    },
    "pac_prs": {
        "label": "Single-Source / PAC PRs", "unit": "%",
        "default_benchmark": 5, "direction": "lower_is_better",
        "description": "% of PRs raised with a pre-assigned vendor (single-source).",
        "multipliers": {"leading": 0.3, "advanced": 0.7, "intermediate": 1.0, "foundation": 2.0},
    },
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
    sess = get_session(session_id)
    overrides = sess.get("formula_overrides") or {}
    catalogue = []
    for kid, meta in KPI_FORMULAS.items():
        ovr = overrides.get(kid, {})
        catalogue.append({
            "kpi_id": kid,
            "label": meta["label"],
            "unit": meta["unit"],
            "direction": meta["direction"],
            "description": meta["description"],
            "default_benchmark": meta["default_benchmark"],
            "default_multipliers": meta["multipliers"],
            "current_benchmark": ovr.get("benchmark", meta["default_benchmark"]),
            "current_multipliers": ovr.get("multipliers", meta["multipliers"]),
        })
    return {"formulas": catalogue}


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
