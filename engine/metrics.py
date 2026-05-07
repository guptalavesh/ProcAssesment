from __future__ import annotations

from typing import Dict, List


# Map each KPI to the source dataframes it requires.
_KPI_TO_SOURCES: Dict[str, List[str]] = {
    "tat_pr_to_po":         ["po_df", "pr_df"],
    "rc_adoption_volume":   ["po_df"],
    "otd":                  ["po_df", "po_gr_df"],
    "savings_per_lpo":      ["po_df"],
    "pac_3way_match":       ["po_df", "invoice_df"],
    "emergency_pr_pct":     ["pr_df"],
    "tail_spend":           ["po_df"],
    "spend_per_fte":        ["po_df", "workforce_df"],
}

# Columns each KPI needs (logical names from the column resolver).
_KPI_TO_COLUMNS: Dict[str, List[str]] = {
    "tat_pr_to_po":         ["po_date", "pr_date"],
    "rc_adoption_volume":   ["net_value", "outline_agreement"],
    "otd":                  ["pr_delivery_date", "gr_date"],
    "savings_per_lpo":      ["po_number", "net_value"],
    "pac_3way_match":       ["po_number", "invoice_number"],
    "emergency_pr_pct":     ["pr_date", "pr_release_date"],
    "tail_spend":           ["vendor", "net_value"],
    "spend_per_fte":        ["net_value", "employee_id"],
}


def get_coverage_preview(
    skill,
    col_map: Dict[str, str],
    available_sources: List[str],
) -> Dict[str, str]:
    """Return a per-dimension coverage string ("X/Y") describing how many of
    the dimension's KPIs have all required sources + columns available.

    A KPI is "ready" when:
      - every source dataframe in _KPI_TO_SOURCES is present, AND
      - every required logical column is in col_map.

    Dimensions with no KPIs return "qre" (driven by questionnaire only).
    """
    available = set(available_sources or [])
    resolved_logical = set(col_map.keys()) if col_map else set()
    coverage: Dict[str, str] = {}

    for dim_id, dim in skill.dimensions.items():
        kpis = list(getattr(dim, "kpis", []) or [])
        if not kpis:
            coverage[dim_id] = "qre"
            continue
        ready = 0
        for kid in kpis:
            sources_needed = _KPI_TO_SOURCES.get(kid, [])
            cols_needed    = _KPI_TO_COLUMNS.get(kid, [])
            sources_ok = all(s in available for s in sources_needed)
            cols_ok    = all(c in resolved_logical for c in cols_needed)
            if sources_ok and cols_ok:
                ready += 1
        coverage[dim_id] = f"{ready}/{len(kpis)}"
    return coverage
