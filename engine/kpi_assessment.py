from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .kpi_engine import (
    BUCKETS, KPI_META, KpiResult,
    _label_from_score, _score_from,
    compute_all_kpis,
)


# ── Result objects (shape mirrored by backend/serializers.py) ────────────────
@dataclass
class BucketResult:
    bucket:      str
    score:       Optional[float]
    score_label: str
    kpis:        List[KpiResult] = field(default_factory=list)


@dataclass
class KpiAssessment:
    overall_score:  Optional[float]
    overall_label:  str
    kpi_results:    Dict[str, KpiResult]
    bucket_results: Dict[str, BucketResult]


def _apply_formula_overrides(
    kpi_results: Dict[str, KpiResult],
    formula_overrides: Dict[str, Dict[str, Any]],
) -> None:
    """Apply user-supplied benchmark / multiplier overrides in-place.

    Override shape: { kpi_id: { "benchmark": float, "multipliers": {level: float} } }
    Multipliers aren't currently surfaced in the UI; benchmark override is the
    primary lever and triggers a re-score.
    """
    for kid, overrides in (formula_overrides or {}).items():
        kr = kpi_results.get(kid)
        if kr is None or not isinstance(overrides, dict):
            continue
        new_bench = overrides.get("benchmark")
        if new_bench is None:
            continue
        try:
            kr.benchmark = float(new_bench)
        except (TypeError, ValueError):
            continue
        kr.score = _score_from(kr.actual, kr.benchmark, kr.direction)
        kr.score_label = _label_from_score(kr.score)


def _bucket_results(kpi_results: Dict[str, KpiResult]) -> Dict[str, BucketResult]:
    """Aggregate KPI scores into buckets via weighted average (KPI weights)."""
    out: Dict[str, BucketResult] = {}
    for bucket, kpi_ids in BUCKETS.items():
        kpis = [kpi_results[k] for k in kpi_ids if k in kpi_results]
        if not kpis:
            out[bucket] = BucketResult(bucket=bucket, score=None, score_label="Insufficient", kpis=[])
            continue
        # Only count available KPIs in the bucket score; if none available,
        # bucket is insufficient.
        avail = [k for k in kpis if k.available]
        if avail:
            tot_w = sum(k.weight for k in avail)
            score = (sum(k.score * k.weight for k in avail) / tot_w) if tot_w > 0 else None
        else:
            score = None
        out[bucket] = BucketResult(
            bucket=bucket,
            score=round(score, 2) if score is not None else None,
            score_label=_label_from_score(score) if score is not None else "Insufficient",
            kpis=kpis,
        )
    return out


def compute_kpi_assessment(
    bundle,
    engagement: Dict[str, Any],
    weight_overrides: Optional[Dict[str, float]] = None,
    formula_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
    formula_params: Optional[Dict[str, Dict[str, Any]]] = None,
) -> KpiAssessment:
    """Procurement KPI assessment.

    - Calls compute_all_kpis to compute the 8 KPI actuals + scores.
    - Applies user benchmark overrides (formula_review screen).
    - Applies user weight overrides (configure screen) so bucket / overall
      scores reflect the customised weights.
    - Aggregates into buckets and an overall weighted average.
    """
    kpi_results = compute_all_kpis(bundle, skill=None, engagement=engagement or {})
    _apply_formula_overrides(kpi_results, formula_overrides or {})

    if weight_overrides:
        for kid, w in weight_overrides.items():
            kr = kpi_results.get(kid)
            if kr is not None:
                try:
                    kr.weight = float(w)
                except (TypeError, ValueError):
                    pass

    buckets = _bucket_results(kpi_results)

    # Overall = weighted average over available KPI scores
    avail = [k for k in kpi_results.values() if k.available]
    overall_score: Optional[float] = None
    if avail:
        tot_w = sum(k.weight for k in avail)
        if tot_w > 0:
            overall_score = round(sum(k.score * k.weight for k in avail) / tot_w, 2)

    return KpiAssessment(
        overall_score=overall_score,
        overall_label=_label_from_score(overall_score) if overall_score is not None else "Insufficient",
        kpi_results=kpi_results,
        bucket_results=buckets,
    )
