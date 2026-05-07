from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


# ── Result objects (shape mirrored by backend/serializers.py) ────────────────
@dataclass
class KpiScoreRef:
    kpi_id: str
    score:  float
    actual: Optional[float]
    weight: float


@dataclass
class DimensionResult:
    dim_id:               str
    name:                 str
    weight:               float
    score:                Optional[float] = None
    score_display:        Optional[float] = None
    level:                Optional[str] = None
    status:               str = "scored"          # scored | partial | qre_only | insufficient
    data_source:          Optional[str] = None    # computed | qre | unavailable
    evidence:             List[str] = field(default_factory=list)
    gaps:                 List[str] = field(default_factory=list)
    recommended_actions:  List[str] = field(default_factory=list)
    rationale:            str = ""
    target_state:         str = ""
    kpi_scores:           Dict[str, KpiScoreRef] = field(default_factory=dict)
    data_sufficiency:     Optional[str] = None
    fallback_score:       Optional[float] = None


@dataclass
class OverallResult:
    score:             Optional[float] = None
    score_display:     Optional[float] = None
    level:             Optional[str] = None
    scored_dims:       int = 0
    total_dims:        int = 0
    active_weight_pct: Optional[float] = None
    description:       str = ""


# ── Helpers ──────────────────────────────────────────────────────────────────
def _level(score: Optional[float]) -> Optional[str]:
    if score is None:
        return None
    if score >= 3.5: return "Leading"
    if score >= 2.5: return "Advanced"
    if score >= 1.5: return "Intermediate"
    return "Foundation"


def _avg_questionnaire(detail: Dict[str, int]) -> Optional[float]:
    """Average a {question_code: 1..4} answer dict into a 1.0..4.0 score."""
    if not detail:
        return None
    vals = [int(v) for v in detail.values() if v is not None]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 2)


def _weighted_avg(scores_with_weights: List[Tuple[float, float]]) -> Optional[float]:
    if not scores_with_weights:
        return None
    total_w = sum(w for _, w in scores_with_weights)
    if total_w <= 0:
        return None
    return sum(s * w for s, w in scores_with_weights) / total_w


# ── Public API ───────────────────────────────────────────────────────────────
def score_all_dimensions(
    skill,
    kpi_results: Dict[str, Any],
    bundle,
    weight_config: Dict[str, float] = None,
    include_dims: Dict[str, bool] = None,
    text_qre_confirmed: Dict[str, int] = None,
    questionnaire_detail: Dict[str, Dict[str, int]] = None,
    engagement: Dict[str, Any] = None,
) -> Tuple[List[DimensionResult], OverallResult]:
    """Score every dimension by blending three signals when present:
      1. Computed KPIs assigned to the dimension (weighted average of KPI scores)
      2. Questionnaire answers (per-dimension average)
      3. Free-text QRE confirmed scores (overrides everything for that dim)

    Returns (list of DimensionResult, OverallResult).
    """
    weight_config        = weight_config or {}
    include_dims         = include_dims or {}
    text_qre_confirmed   = text_qre_confirmed or {}
    questionnaire_detail = questionnaire_detail or {}

    dim_results: List[DimensionResult] = []
    for dim_id, dim in skill.dimensions.items():
        weight = weight_config.get(dim_id, dim.weight)
        included = include_dims.get(dim_id, True)

        # If excluded: still render in UI but mark insufficient.
        if not included:
            dim_results.append(DimensionResult(
                dim_id=dim_id, name=dim.name, weight=weight,
                status="insufficient", data_source="unavailable",
                rationale="Dimension excluded from this assessment.",
            ))
            continue

        # 1. Free-text QRE override
        text_score = text_qre_confirmed.get(dim_id)
        if text_score is not None:
            dim_results.append(DimensionResult(
                dim_id=dim_id, name=dim.name, weight=weight,
                score=float(text_score), score_display=float(text_score),
                level=_level(float(text_score)),
                status="qre_only", data_source="qre",
                rationale="Score derived from free-text QRE input (user-confirmed).",
            ))
            continue

        # 2. Computed KPI roll-up
        kpi_ids = list(getattr(dim, "kpis", []) or [])
        kpi_pairs: List[Tuple[float, float]] = []
        kpi_score_refs: Dict[str, KpiScoreRef] = {}
        evidence: List[str] = []
        gaps: List[str] = []
        any_available = False
        for kid in kpi_ids:
            kr = kpi_results.get(kid)
            if kr is None:
                continue
            score = float(getattr(kr, "score", 1.0))
            actual = getattr(kr, "actual", None)
            available = bool(getattr(kr, "available", False))
            w = float(getattr(kr, "weight", 0.1))
            kpi_score_refs[kid] = KpiScoreRef(kpi_id=kid, score=score, actual=actual, weight=w)
            if available:
                any_available = True
                kpi_pairs.append((score, w))
                if score >= 3.0:
                    evidence.append(f"{getattr(kr, 'label', kid)} at {getattr(kr, 'score_label', '—')}")
                elif score < 2.0:
                    gaps.append(f"{getattr(kr, 'label', kid)} below benchmark")

        kpi_score = _weighted_avg(kpi_pairs)

        # 3. Questionnaire average for this dim
        qre_score = _avg_questionnaire(questionnaire_detail.get(dim_id) or {})

        # Blend: when both KPI and QRE are present, take the weighted blend
        # 60% KPI / 40% QRE (KPIs are more objective).
        final_score: Optional[float] = None
        status = "insufficient"
        data_source = "unavailable"
        rationale = ""
        if kpi_score is not None and qre_score is not None:
            final_score = round(0.6 * kpi_score + 0.4 * qre_score, 2)
            status, data_source = "scored", "computed"
            rationale = "Score blended from computed KPIs (60%) and questionnaire (40%)."
        elif kpi_score is not None:
            final_score = round(kpi_score, 2)
            status, data_source = ("scored" if any_available else "partial"), "computed"
            rationale = "Score derived from computed KPI roll-up."
        elif qre_score is not None:
            final_score = round(qre_score, 2)
            status, data_source = "qre_only", "qre"
            rationale = "Score derived from questionnaire answers."
        else:
            rationale = "Insufficient data for this dimension."

        dim_results.append(DimensionResult(
            dim_id=dim_id, name=dim.name, weight=weight,
            score=final_score, score_display=final_score,
            level=_level(final_score),
            status=status, data_source=data_source,
            evidence=evidence[:5], gaps=gaps[:5],
            recommended_actions=[],
            rationale=rationale,
            kpi_scores=kpi_score_refs,
            data_sufficiency=("full" if final_score is not None and any_available else
                              "partial" if final_score is not None else
                              "insufficient"),
        ))

    # Overall: weighted average over scored dimensions
    scored = [d for d in dim_results if d.score is not None]
    overall_score: Optional[float] = None
    active_w = 0.0
    if scored:
        total_w = sum(d.weight for d in scored)
        if total_w > 0:
            overall_score = round(sum(d.score * d.weight for d in scored) / total_w, 2)
            active_w = round(total_w * 100, 1)

    overall = OverallResult(
        score=overall_score,
        score_display=overall_score,
        level=_level(overall_score),
        scored_dims=len(scored),
        total_dims=len(dim_results),
        active_weight_pct=active_w,
        description=(_level(overall_score) or "Insufficient data") +
                    (f" — {len(scored)} of {len(dim_results)} dimensions scored." if scored else ""),
    )
    return dim_results, overall
