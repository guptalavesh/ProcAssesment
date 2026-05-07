from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd


# ── KPI metadata ─────────────────────────────────────────────────────────────
KPI_META: Dict[str, Dict[str, Any]] = {
    "tat_pr_to_po": {
        "label":     "PR-to-PO turnaround",
        "weight":    0.15,
        "direction": "lower_is_better",
        "unit":      "days",
        "bucket":    "Efficiency",
        "sources":   ["po_df", "pr_df"],
    },
    "rc_adoption_volume": {
        "label":     "Rate-contract adoption (volume)",
        "weight":    0.15,
        "direction": "higher_is_better",
        "unit":      "%",
        "bucket":    "Effectiveness",
        "sources":   ["po_df"],
    },
    "otd": {
        "label":     "On-time delivery",
        "weight":    0.10,
        "direction": "higher_is_better",
        "unit":      "%",
        "bucket":    "Vendor Management",
        "sources":   ["po_df", "po_gr_df"],
    },
    "savings_per_lpo": {
        "label":     "Savings realised per LPO",
        "weight":    0.15,
        "direction": "higher_is_better",
        "unit":      "%",
        "bucket":    "Effectiveness",
        "sources":   ["po_df"],
    },
    "pac_3way_match": {
        "label":     "3-way match (post-audit compliance)",
        "weight":    0.10,
        "direction": "higher_is_better",
        "unit":      "%",
        "bucket":    "Risk",
        "sources":   ["po_df", "invoice_df"],
    },
    "emergency_pr_pct": {
        "label":     "Emergency PR rate",
        "weight":    0.10,
        "direction": "lower_is_better",
        "unit":      "%",
        "bucket":    "Risk",
        "sources":   ["pr_df"],
    },
    "tail_spend": {
        "label":     "Tail spend share",
        "weight":    0.10,
        "direction": "lower_is_better",
        "unit":      "%",
        "bucket":    "Efficiency",
        "sources":   ["po_df"],
    },
    "spend_per_fte": {
        "label":     "Spend managed per FTE",
        "weight":    0.15,
        "direction": "higher_is_better",
        "unit":      "₹ Cr",
        "bucket":    "Effectiveness",
        "sources":   ["po_df", "workforce_df"],
    },
}

BUCKETS: Dict[str, list] = {
    "Efficiency":         ["tat_pr_to_po", "tail_spend"],
    "Effectiveness":      ["rc_adoption_volume", "savings_per_lpo", "spend_per_fte"],
    "Vendor Management":  ["otd"],
    "Risk":               ["pac_3way_match", "emergency_pr_pct"],
}

BUCKET_ICONS: Dict[str, str] = {
    "Efficiency":        "Zap",
    "Effectiveness":     "Target",
    "Vendor Management": "Users",
    "Risk":              "AlertTriangle",
}


# ── Result dataclasses ───────────────────────────────────────────────────────
@dataclass
class KpiResult:
    kpi_id:      str
    label:       str
    bucket:      str
    weight:      float
    direction:   str
    unit:        str
    actual:      Optional[float]
    benchmark:   Optional[float]
    score:       float                # 1.0..4.0
    score_label: str
    available:   bool = True


# ── Helpers ──────────────────────────────────────────────────────────────────
def _col(bundle, logical: str, df_name: str = "po_df") -> Optional[str]:
    """Resolve a logical column name to its actual header in the named df."""
    actual = bundle.col_map.get(logical)
    df = bundle.get(df_name)
    if df is not None and actual and actual in df.columns:
        return actual
    return None


def _to_dt(series) -> pd.Series:
    return pd.to_datetime(series, errors="coerce")


def _safe_mean(series) -> Optional[float]:
    s = pd.to_numeric(series, errors="coerce").dropna()
    return float(s.mean()) if len(s) else None


def _score_from(actual: Optional[float], benchmark: Optional[float], direction: str) -> float:
    """Map a value vs benchmark to a 1..4 score using a smooth 4-step ramp.

    higher_is_better: actual >= 1.20*bench → 4; >= bench → 3; >= 0.80*bench → 2; else 1
    lower_is_better:  actual <= 0.80*bench → 4; <= bench → 3; <= 1.20*bench → 2; else 1
    """
    if actual is None or benchmark is None or benchmark == 0:
        return 1.0
    ratio = actual / benchmark
    if direction == "higher_is_better":
        if ratio >= 1.20: return 4.0
        if ratio >= 1.00: return 3.0
        if ratio >= 0.80: return 2.0
        return 1.0
    # lower_is_better
    if ratio <= 0.80: return 4.0
    if ratio <= 1.00: return 3.0
    if ratio <= 1.20: return 2.0
    return 1.0


def _label_from_score(score: float) -> str:
    if score >= 3.5: return "Leading"
    if score >= 2.5: return "Advanced"
    if score >= 1.5: return "Intermediate"
    return "Foundation"


# ── Per-KPI computations ─────────────────────────────────────────────────────
def _kpi_tat_pr_to_po(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    if po_df is None or po_df.empty:
        return None
    po_date = _col(bundle, "po_date", "po_df")
    if not po_date:
        return None
    pr_df = bundle.get("pr_df")
    pr_date_pr = _col(bundle, "pr_date", "pr_df") or _col(bundle, "pr_creation_date", "pr_df")
    pr_num_po  = _col(bundle, "pr_reference", "po_df")
    pr_num_pr  = _col(bundle, "pr_number", "pr_df")
    if pr_df is not None and pr_date_pr and pr_num_po and pr_num_pr:
        # Join PR date onto PO via PR number
        try:
            left  = po_df[[pr_num_po, po_date]].copy()
            right = pr_df[[pr_num_pr, pr_date_pr]].copy().drop_duplicates(pr_num_pr)
            left[pr_num_po]   = left[pr_num_po].astype(str).str.strip()
            right[pr_num_pr]  = right[pr_num_pr].astype(str).str.strip()
            merged = left.merge(right, left_on=pr_num_po, right_on=pr_num_pr, how="inner")
            tat = (_to_dt(merged[po_date]) - _to_dt(merged[pr_date_pr])).dt.days
            return _safe_mean(tat[tat >= 0])
        except Exception:
            pass
    # Fallback: use any PR-date column on the PO df
    for cand in ("pr_date", "pr_creation_date"):
        c = _col(bundle, cand, "po_df")
        if c:
            tat = (_to_dt(po_df[po_date]) - _to_dt(po_df[c])).dt.days
            return _safe_mean(tat[tat >= 0])
    return None


def _kpi_rc_adoption_volume(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    if po_df is None or po_df.empty:
        return None
    val_col = _col(bundle, "net_value", "po_df")
    if not val_col:
        return None
    total = pd.to_numeric(po_df[val_col], errors="coerce").fillna(0).sum()
    if total <= 0:
        return None
    if "agreement" in po_df.columns:
        agreed = po_df["agreement"].astype(str).str.strip().replace("nan", "")
        mask = agreed.ne("")
    else:
        oa  = _col(bundle, "outline_agreement", "po_df")
        ctr = _col(bundle, "contract_number",   "po_df")
        if not oa and not ctr:
            return None
        s = pd.Series(False, index=po_df.index)
        for c in (oa, ctr):
            if c and c in po_df.columns:
                s = s | po_df[c].astype(str).str.strip().replace("nan", "").ne("")
        mask = s
    rc_value = pd.to_numeric(po_df.loc[mask, val_col], errors="coerce").fillna(0).sum()
    return float(rc_value / total)


def _kpi_otd(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    gr_df = bundle.get("po_gr_df") or po_df
    if gr_df is None or gr_df.empty:
        return None
    deliv = _col(bundle, "pr_delivery_date", "po_df") or _col(bundle, "pr_delivery_date", "po_gr_df")
    actual = _col(bundle, "gr_date", "po_df") or _col(bundle, "gr_date", "po_gr_df")
    if not deliv or not actual:
        return None
    d = gr_df if (deliv in gr_df.columns and actual in gr_df.columns) else po_df
    if d is None or deliv not in d.columns or actual not in d.columns:
        return None
    delta = (_to_dt(d[actual]) - _to_dt(d[deliv])).dt.days
    delta = delta.dropna()
    if not len(delta):
        return None
    on_time = (delta <= 0).sum()
    return float(on_time / len(delta))


def _kpi_savings_per_lpo(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    if po_df is None or po_df.empty:
        return None
    if "last po price" not in po_df.columns:
        return None
    price = _col(bundle, "net_price", "po_df")
    qty   = _col(bundle, "quantity", "po_df")
    val   = _col(bundle, "net_value", "po_df")
    if not price or "last po price" not in po_df.columns:
        return None
    cur = pd.to_numeric(po_df[price], errors="coerce")
    last = pd.to_numeric(po_df["last po price"], errors="coerce")
    qcol = pd.to_numeric(po_df[qty], errors="coerce") if qty else pd.Series(1.0, index=po_df.index)
    delta = (last - cur).fillna(0)
    savings = (delta * qcol.fillna(0)).clip(lower=0).sum()
    if val:
        total = pd.to_numeric(po_df[val], errors="coerce").fillna(0).sum()
        if total > 0:
            return float(savings / total)
    return None


def _kpi_pac_3way_match(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    inv_df = bundle.get("invoice_df")
    if po_df is None or inv_df is None or po_df.empty or inv_df.empty:
        return None
    po_num   = _col(bundle, "po_number", "po_df")
    inv_ref  = _col(bundle, "po_reference", "invoice_df") or "PO_Reference"
    if not po_num or inv_ref not in inv_df.columns:
        return None
    po_keys  = po_df[po_num].astype(str).str.strip()
    inv_keys = inv_df[inv_ref].astype(str).str.strip()
    if not len(inv_keys):
        return None
    matched = inv_keys.isin(set(po_keys)).sum()
    return float(matched / len(inv_keys))


def _kpi_emergency_pr_pct(bundle) -> Optional[float]:
    pr_df = bundle.get("pr_df")
    if pr_df is None or pr_df.empty:
        return None
    pr_date = _col(bundle, "pr_date", "pr_df") or _col(bundle, "pr_creation_date", "pr_df")
    rel     = _col(bundle, "pr_release_date", "pr_df")
    if not pr_date or not rel:
        return None
    delta = (_to_dt(pr_df[rel]) - _to_dt(pr_df[pr_date])).dt.days.dropna()
    if not len(delta):
        return None
    emergency = (delta <= 1).sum()  # released same / next day
    return float(emergency / len(delta))


def _kpi_tail_spend(bundle) -> Optional[float]:
    po_df = bundle.get("po_df")
    if po_df is None or po_df.empty:
        return None
    val_col = _col(bundle, "net_value", "po_df")
    vendor  = _col(bundle, "vendor", "po_df") or _col(bundle, "vendor_name", "po_df")
    if not val_col or not vendor:
        return None
    by_vendor = po_df.groupby(vendor)[val_col].apply(lambda s: pd.to_numeric(s, errors="coerce").fillna(0).sum())
    total = by_vendor.sum()
    if total <= 0:
        return None
    sorted_desc = by_vendor.sort_values(ascending=False)
    cumulative = sorted_desc.cumsum() / total
    # Vendors past the 80% cumulative line are "tail"
    tail_mask = cumulative > 0.80
    tail_value = sorted_desc[tail_mask].sum()
    return float(tail_value / total)


def _kpi_spend_per_fte(bundle, engagement: Dict[str, Any]) -> Optional[float]:
    po_df = bundle.get("po_df")
    val_col = _col(bundle, "net_value", "po_df")
    fte = engagement.get("fte_count")
    if po_df is None or not val_col or not fte:
        return None
    total = pd.to_numeric(po_df[val_col], errors="coerce").fillna(0).sum()
    try:
        fte = float(fte)
    except Exception:
        return None
    if fte <= 0:
        return None
    # Convert to ₹ Cr (assumes input is in ₹). 1 Cr = 1e7.
    return float(total / fte / 1e7)


# ── Benchmarks (default; benchmark_loader can override per-industry) ─────────
DEFAULT_BENCHMARKS: Dict[str, float] = {
    "tat_pr_to_po":         9.0,    # days
    "rc_adoption_volume":   0.65,   # 65%
    "otd":                  0.85,   # 85%
    "savings_per_lpo":      0.05,   # 5%
    "pac_3way_match":       0.90,   # 90%
    "emergency_pr_pct":     0.10,   # 10%
    "tail_spend":           0.20,   # 20%
    "spend_per_fte":        18.0,   # ₹18 Cr / FTE
}


# ── Public entry point ───────────────────────────────────────────────────────
def compute_all_kpis(
    bundle,
    skill,
    engagement: Dict[str, Any],
    benchmarks: Optional[Dict[str, float]] = None,
) -> Dict[str, KpiResult]:
    """Compute every KPI in KPI_META. KPIs that can't be computed (missing
    data / columns) come back with `available=False` and score=1.0."""
    benchmarks = {**DEFAULT_BENCHMARKS, **(benchmarks or {})}

    # Compute raw actuals
    actuals: Dict[str, Optional[float]] = {
        "tat_pr_to_po":       _kpi_tat_pr_to_po(bundle),
        "rc_adoption_volume": _kpi_rc_adoption_volume(bundle),
        "otd":                _kpi_otd(bundle),
        "savings_per_lpo":    _kpi_savings_per_lpo(bundle),
        "pac_3way_match":     _kpi_pac_3way_match(bundle),
        "emergency_pr_pct":   _kpi_emergency_pr_pct(bundle),
        "tail_spend":         _kpi_tail_spend(bundle),
        "spend_per_fte":      _kpi_spend_per_fte(bundle, engagement or {}),
    }

    results: Dict[str, KpiResult] = {}
    for kid, meta in KPI_META.items():
        actual = actuals.get(kid)
        bench = benchmarks.get(kid)
        score = _score_from(actual, bench, meta["direction"])
        results[kid] = KpiResult(
            kpi_id=kid,
            label=meta["label"],
            bucket=meta["bucket"],
            weight=meta["weight"],
            direction=meta["direction"],
            unit=meta["unit"],
            actual=actual,
            benchmark=bench,
            score=score,
            score_label=_label_from_score(score),
            available=actual is not None,
        )
    return results
