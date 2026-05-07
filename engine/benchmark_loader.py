from __future__ import annotations

from typing import Any, Dict


# Industry-keyed benchmarks. When an industry isn't found we fall back to the
# values in DEFAULTS — same defaults that kpi_engine uses for scoring.
DEFAULTS: Dict[str, float] = {
    "tat_pr_to_po":         9.0,
    "rc_adoption_volume":   0.65,
    "otd":                  0.85,
    "savings_per_lpo":      0.05,
    "pac_3way_match":       0.90,
    "emergency_pr_pct":     0.10,
    "tail_spend":           0.20,
    "spend_per_fte":        18.0,
}

INDUSTRY_OVERRIDES: Dict[str, Dict[str, float]] = {
    "Metals & Mining":     {"tat_pr_to_po": 11.0, "otd": 0.82, "tail_spend": 0.22},
    "Cement":              {"tat_pr_to_po": 10.0, "rc_adoption_volume": 0.70, "tail_spend": 0.18},
    "Building Materials":  {"tat_pr_to_po": 8.0,  "otd": 0.86},
    "Chemicals":           {"tat_pr_to_po": 8.0,  "rc_adoption_volume": 0.68, "pac_3way_match": 0.92},
    "Paper & Agro":        {"tat_pr_to_po": 9.0,  "tail_spend": 0.24},
    "Textiles":            {"tat_pr_to_po": 7.0,  "tail_spend": 0.25},
    "Automotive":          {"tat_pr_to_po": 6.0,  "rc_adoption_volume": 0.78, "otd": 0.90, "spend_per_fte": 22.0},
    "FMCG":                {"tat_pr_to_po": 6.0,  "rc_adoption_volume": 0.74, "spend_per_fte": 25.0},
    "Oil & Gas":           {"tat_pr_to_po": 12.0, "pac_3way_match": 0.93, "spend_per_fte": 30.0},
    "Pharmaceuticals":     {"tat_pr_to_po": 8.0,  "pac_3way_match": 0.95, "emergency_pr_pct": 0.08},
}


def load_benchmarks(industry: str) -> Dict[str, float]:
    """Return a {kpi_id: value} benchmark map for the given industry,
    falling back to DEFAULTS for any KPI the industry doesn't override."""
    base = dict(DEFAULTS)
    base.update(INDUSTRY_OVERRIDES.get(industry or "", {}))
    return base


def _format(kid: str, val: float) -> str:
    """Render a benchmark for the UI (matches serializers' KPI formatting)."""
    if val is None:
        return "—"
    if kid == "tat_pr_to_po":
        return f"{round(val)} days"
    if kid == "spend_per_fte":
        return f"₹{round(val, 1)} Cr"
    # The rest are percentages
    return f"{round(val * 100)}%"


def get_benchmark_display(benchmarks: Dict[str, float]) -> Dict[str, Dict[str, Any]]:
    """Return {kpi_id: {value, formatted}} for the configure screen."""
    return {kid: {"value": val, "formatted": _format(kid, val)} for kid, val in (benchmarks or {}).items()}
