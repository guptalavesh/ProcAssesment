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
    score = _clean(getattr(kr, "score", None))
    available = getattr(kr, "available", True)
    if actual is None:
        # Engine sometimes assigns a "Foundation 1.0" floor even when there's
        # no real measurement. From a UX perspective: no value = no score.
        available = False
        score = None

    # Format actual and benchmark for display
    def _fmt(v, u):
        if v is None: return "—"
        if u == "%": return f"{round(v * 100)}%"
        if u == "days": return f"{round(v)} days"
        if u == "₹ Cr": return f"₹{round(v, 1)} Cr"
        return str(round(v, 2))

    # Gap percentage as a *fraction* (positive = above benchmark for the
    # KPI's preferred direction, negative = below). Frontend multiplies by
    # 100 to render. Capped at ±9.99 (= ±999%) so a divide-by-tiny doesn't
    # blow up the column width.
    gap_pct: Optional[float] = None
    if actual is not None and benchmark is not None and benchmark != 0:
        if direction == "higher_is_better":
            gap_pct = (actual - benchmark) / abs(benchmark)
        else:
            gap_pct = (benchmark - actual) / abs(benchmark)
        if gap_pct is not None:
            gap_pct = max(-9.99, min(9.99, gap_pct))
        gap_pct = _clean(gap_pct)

    # has_gap: scoreboard / status pill in the frontend reads this. A KPI
    # has a gap if it scored ≤ 2 (Foundation/Intermediate) or finished
    # below benchmark on its preferred direction.
    has_gap: Optional[bool] = None
    if actual is not None and benchmark is not None:
        below = (actual < benchmark) if direction == "higher_is_better" else (actual > benchmark)
        score_weak = score is not None and score <= 2
        has_gap = bool(below or score_weak)

    return {
        "kpi_id":    getattr(kr, "kpi_id", None),
        "label":     getattr(kr, "label", ""),
        "actual":    actual,
        "benchmark": benchmark,
        "score":     score,
        "score_label": getattr(kr, "score_label", None),
        "direction": direction,
        "unit":      unit,
        "weight":    _clean(getattr(kr, "weight", None)),
        "bucket":    getattr(kr, "bucket", ""),
        "gap_pct":   gap_pct,
        "has_gap":   has_gap,
        "formatted_actual":    _fmt(actual, unit),
        "formatted_benchmark": _fmt(benchmark, unit),
        "available": available,
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
