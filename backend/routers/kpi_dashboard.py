from __future__ import annotations
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException

from session_store import get_session

router = APIRouter(tags=["kpi_dashboard"])


# ── Column resolution helper ──────────────────────────────────────────────────
def _get_po_col(po_df, logical_name: str, col_map: dict) -> Optional[str]:
    """Find actual column in PO df by logical name. Tries col_map first,
    then candidate list, then fuzzy match."""
    if logical_name in col_map and col_map[logical_name] in po_df.columns:
        return col_map[logical_name]
    CANDIDATES = {
        "net_value": ["Net_Value","net_value","Net Value","Total_Value","PO_Value","Order_Value","NETWR"],
        "vendor": ["Vendor","vendor","Vendor_Code","LIFNR","Supplier"],
        "plant": ["Plant","plant","Werks","WERKS"],
        "po_date": ["PO_Creation_Date","PO_Date","Document_Date","BEDAT"],
        "material_group": ["Material_Group","Material_Grp","MATKL","MatGrp"],
        "material_group_desc": ["Material_Group_Desc","Matl_Grp_Desc"],
        "purchase_group": ["Purchase_Group","Purchasing_Group","EKGRP"],
        "outline_agreement": ["Outline_Agreement","Framework_Order","KONNR"],
        "contract_number": ["Contract_Number","Contract_No","KONNR"],
        "agreement": ["agreement","agreement_number","Outline_Agreement","Contract_Number"],
        "gr_date": ["GR_Date","Goods_Receipt_Date","Entry_Date","BUDAT"],
        "pr_delivery_date": ["Delivery_Date","Sched_Del_Date","EINDT"],
        "short_text": ["Short_Text","Material_Description","TXZ01"],
        "po_number": ["PO_Number","Purchase_Order","EBELN"],
        "pr_reference": ["PR_Reference","PR_Ref","BANFN","Requisition_No"],
        "net_price": ["Net_Price","Unit_Price","NETPR"],
        "material_number": ["Material_Number","Material","MATNR"],
        "material_type": ["Material_Type","Mat_Type","MTART"],
        "vendor_name": ["Vendor_Name","Name_1","NAME1"],
        "last_po_price": ["last po price","last_po_price","LPO_Price"],
    }
    cands = CANDIDATES.get(logical_name, [logical_name])
    for c in cands:
        if c in po_df.columns: return c
        for col in po_df.columns:
            if col.lower() == c.lower(): return col
    return None


def _to_cr(value_rupees: float) -> float:
    """Convert rupees to crores (÷ 1e7)."""
    return float(value_rupees) / 1e7


def _tat_trim(arr, low_pct=5, high_pct=95):
    """Trim TAT array to P5-P95 to remove outliers."""
    import numpy as np
    if len(arr) < 3: return arr
    lo, hi = np.percentile(arr, [low_pct, high_pct])
    return arr[(arr >= lo) & (arr <= hi)]


def _monthly_trend(df, date_col, value_col, agg_fn="mean"):
    """Build monthly trend [{month: "2024-01", value: 42.3}, ...]"""
    try:
        tmp = df[[date_col, value_col]].copy()
        tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
        tmp[value_col] = pd.to_numeric(tmp[value_col], errors="coerce")
        tmp = tmp.dropna()
        tmp["month"] = tmp[date_col].dt.to_period("M").astype(str)
        if agg_fn == "mean": agg = tmp.groupby("month")[value_col].mean()
        elif agg_fn == "sum": agg = tmp.groupby("month")[value_col].sum()
        else: agg = tmp.groupby("month")[value_col].count()
        return [{"month": m, "value": round(float(v), 2)} for m, v in agg.items()]
    except Exception: return []


def _percent_breakdown(po_df, group_col: str, flag_series, top_n: int = 10):
    """Render `[{name, value, pct}]` rows: % of POs in `group_col` that match
    `flag_series`. Sorted by group volume desc, capped at top_n. Used for the
    by_plant / by_category / by_vendor breakdown panels on KPIs that compute
    a ratio (RC adoption, single-source PRs, etc)."""
    if group_col is None or group_col not in po_df.columns:
        return []
    try:
        grouped = po_df.assign(_flag=flag_series.astype(int)).groupby(group_col).agg(
            total=("_flag", "size"),
            hits=("_flag", "sum"),
        )
        grouped = grouped[grouped["total"] >= 5].sort_values("total", ascending=False).head(top_n)
        rows = []
        for name, row in grouped.iterrows():
            pct = round(float(row["hits"] / row["total"] * 100), 1) if row["total"] else 0.0
            rows.append({"name": str(name), "value": pct, "pct": pct, "n": int(row["total"])})
        return rows
    except Exception:
        return []


def _value_breakdown(po_df, group_col: str, value_col: str, top_n: int = 10, to_cr: bool = True):
    """Render `[{name, value, pct}]`: total spend per group, top_n only.
    `pct` is share of overall total."""
    if group_col is None or group_col not in po_df.columns or value_col is None or value_col not in po_df.columns:
        return []
    try:
        nv = pd.to_numeric(po_df[value_col], errors="coerce").fillna(0)
        grouped = po_df.assign(_nv=nv).groupby(group_col)["_nv"].sum().sort_values(ascending=False).head(top_n)
        total = float(grouped.sum()) or 1.0
        rows = []
        for name, val in grouped.items():
            display = round(float(val) / 1e7, 2) if to_cr else round(float(val), 2)
            rows.append({"name": str(name), "value": display, "pct": round(float(val) / total * 100, 1)})
        return rows
    except Exception:
        return []


def _kpi_tat_pr_to_po(po_df, pr_df, col_map, params=None):
    """Compute PR-to-PO TAT (days). Returns KpiData dict."""
    import numpy as np
    try:
        po_date_col = _get_po_col(po_df, "po_date", col_map)
        if pr_df is not None and not pr_df.empty:
            pr_num_col = next((c for c in ["PR_Number","pr_number","pr no","PR_No"] if c in pr_df.columns), None)
            pr_date_col_in_pr = next((c for c in ["PR_Creation_Date","pr_date","pr_creation_date"] if c in pr_df.columns), None)
            po_pr_ref_col = _get_po_col(po_df, "pr_reference", col_map)
            if pr_num_col and pr_date_col_in_pr and po_pr_ref_col:
                pr_dates = pr_df[[pr_num_col, pr_date_col_in_pr]].rename(
                    columns={pr_num_col: "_pr_key", pr_date_col_in_pr: "_pr_date"}
                )
                merged = po_df[[po_date_col, po_pr_ref_col]].rename(
                    columns={po_pr_ref_col: "_pr_key"}
                ).merge(pr_dates, on="_pr_key", how="inner")
                if len(merged) > 0:
                    po_dates = pd.to_datetime(merged[po_date_col], errors="coerce")
                    pr_dates_s = pd.to_datetime(merged["_pr_date"], errors="coerce")
                    tats = (po_dates - pr_dates_s).dt.days.dropna()
                    tats = tats[tats > 0]
                    params = params or {}
                    lo = params.get("outlier_trim_low", 5)
                    hi = params.get("outlier_trim_high", 95)
                    tats_arr = np.array(tats)
                    tats_arr = _tat_trim(tats_arr, lo, hi)
                    if len(tats_arr) > 0:
                        avg_tat = float(np.mean(tats_arr))
                        # Trend: build off the same positive-only series so the
                        # monthly average never goes negative (some merged rows
                        # land where PR_date > PO_date — bad data, drop).
                        trend_src = merged.assign(_tat=(po_dates - pr_dates_s).dt.days)
                        trend_src = trend_src[trend_src["_tat"] > 0]
                        trend = _monthly_trend(trend_src, po_date_col, "_tat", "mean")
                        # By-plant / by-vendor / by-category breakdowns: average
                        # TAT per group. Need the matching po_df rows merged
                        # back onto the trend_src so we have the dimension
                        # columns alongside `_tat`.
                        plant_col  = _get_po_col(po_df, "plant",          col_map)
                        cat_col    = _get_po_col(po_df, "material_group", col_map)
                        vendor_col = _get_po_col(po_df, "vendor",         col_map)
                        pg_col     = _get_po_col(po_df, "purchase_group", col_map)
                        # Build a single keyed view: trend_src already has
                        # po_date_col + _pr_key. Re-merge to get dimension cols.
                        po_keyed = po_df[[po_pr_ref_col]].rename(columns={po_pr_ref_col: "_pr_key"})
                        po_keyed = po_keyed.assign(_tat=tats.values[:len(po_keyed)] if len(po_keyed) == len(tats) else None)
                        # Simpler: average per-row TAT joined back via index.
                        merged_by_idx = trend_src.copy()
                        for col in (plant_col, cat_col, vendor_col, pg_col):
                            if col and col in po_df.columns:
                                merged_by_idx[col] = po_df.loc[merged_by_idx.index.intersection(po_df.index), col] if False else None

                        def _avg_breakdown(group_col):
                            if not group_col or group_col not in po_df.columns:
                                return []
                            try:
                                # Need the avg TAT per group. Re-merge cleanly.
                                m = po_df[[po_pr_ref_col, group_col]].rename(columns={po_pr_ref_col: "_pr_key"})
                                m = m.merge(pr_dates, on="_pr_key", how="inner")
                                m["_tat"] = (
                                    pd.to_datetime(po_df.loc[m.index, po_date_col], errors="coerce")
                                    - pd.to_datetime(m["_pr_date"], errors="coerce")
                                ).dt.days if False else None
                                # Fallback: use the simpler grouping path against trend_src
                                if group_col in trend_src.columns:
                                    grouped = trend_src.groupby(group_col)["_tat"].agg(["mean", "size"])
                                    grouped = grouped[grouped["size"] >= 5].sort_values("size", ascending=False).head(10)
                                    return [
                                        {"name": str(name), "value": round(float(row["mean"]), 1), "n": int(row["size"])}
                                        for name, row in grouped.iterrows()
                                    ]
                                return []
                            except Exception:
                                return []

                        # The trend_src came from merged which only has po_date_col + _pr_key.
                        # For breakdowns, build a clean per-PO TAT df with dim cols.
                        tat_with_dims = po_df.copy()
                        # Map _pr_key (PR_Reference) -> pr_date and compute TAT per PO row.
                        pr_lookup = pr_dates.set_index("_pr_key")["_pr_date"].to_dict()
                        tat_with_dims["_pr_date"] = tat_with_dims[po_pr_ref_col].map(pr_lookup)
                        tat_with_dims["_tat"] = (
                            pd.to_datetime(tat_with_dims[po_date_col], errors="coerce")
                            - pd.to_datetime(tat_with_dims["_pr_date"], errors="coerce")
                        ).dt.days
                        tat_with_dims = tat_with_dims[tat_with_dims["_tat"].notna() & (tat_with_dims["_tat"] > 0)]

                        def _grp(col):
                            if not col or col not in tat_with_dims.columns: return []
                            grp = tat_with_dims.groupby(col)["_tat"].agg(["mean", "size"])
                            grp = grp[grp["size"] >= 5].sort_values("size", ascending=False).head(10)
                            return [
                                {"name": str(name), "value": round(float(row["mean"]), 1), "n": int(row["size"])}
                                for name, row in grp.iterrows()
                            ]

                        return {
                            "id": "tat_pr_to_po", "label": "PR-to-PO TAT",
                            "available": True, "value": round(avg_tat, 1),
                            "unit": "days", "benchmark": 9,
                            "direction": "lower_is_better",
                            "trend": trend[:24],
                            "by_plant":          _grp(plant_col),
                            "by_vendor":         _grp(vendor_col),
                            "by_category":       _grp(cat_col),
                            "by_purchase_group": _grp(pg_col),
                            "confidence": "high" if len(tats_arr) >= 50 else "medium",
                            "row_count": len(tats_arr),
                        }
        return {"id": "tat_pr_to_po", "label": "PR-to-PO TAT", "available": False, "value": None,
                "unit": "days", "benchmark": 9, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
    except Exception as e:
        print(f"[kpi_tat] ERROR: {e}")
        return {"id": "tat_pr_to_po", "label": "PR-to-PO TAT", "available": False, "value": None,
                "unit": "days", "benchmark": 9, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_rc_adoption(po_df, col_map, params=None):
    """RC adoption by volume and value. Returns (vol_kpi, val_kpi)."""
    try:
        rc_col = next((c for c in ["agreement","agreement_number"] if c in po_df.columns), None)
        if rc_col is None:
            contract_col = _get_po_col(po_df, "contract_number", col_map)
            outline_col = _get_po_col(po_df, "outline_agreement", col_map)
            rc_flag = pd.Series(False, index=po_df.index)
            if contract_col: rc_flag |= po_df[contract_col].notna() & (po_df[contract_col].astype(str).str.strip() != "")
            if outline_col: rc_flag |= po_df[outline_col].notna() & (po_df[outline_col].astype(str).str.strip() != "")
        else:
            rc_flag = po_df[rc_col].notna() & (po_df[rc_col].astype(str).str.strip() != "")
        if len(po_df) == 0:
            return ({"available": False}, {"available": False})
        rc_vol_pct = round(float(rc_flag.mean() * 100), 1)
        nv_col = _get_po_col(po_df, "net_value", col_map)
        rc_val_pct = None
        if nv_col:
            nv = pd.to_numeric(po_df[nv_col], errors="coerce").fillna(0)
            total = nv.sum()
            if total > 0: rc_val_pct = round(float(nv[rc_flag].sum() / total * 100), 1)
        plant_col    = _get_po_col(po_df, "plant",          col_map)
        cat_col      = _get_po_col(po_df, "material_group", col_map)
        vendor_col   = _get_po_col(po_df, "vendor",         col_map)
        pg_col       = _get_po_col(po_df, "purchase_group", col_map)
        vol_kpi = {
            "id": "rc_adoption_volume", "label": "RC Adoption (Volume)",
            "available": True, "value": rc_vol_pct,
            "unit": "%", "benchmark": 65, "direction": "higher_is_better",
            "trend": [],
            "by_plant":          _percent_breakdown(po_df, plant_col,  rc_flag),
            "by_vendor":         _percent_breakdown(po_df, vendor_col, rc_flag),
            "by_category":       _percent_breakdown(po_df, cat_col,    rc_flag),
            "by_purchase_group": _percent_breakdown(po_df, pg_col,     rc_flag),
            "confidence": "high" if len(po_df) >= 50 else "medium",
        }
        val_kpi = {
            "id": "rc_adoption_value", "label": "RC Adoption (Value)",
            "available": rc_val_pct is not None, "value": rc_val_pct,
            "unit": "%", "benchmark": 60, "direction": "higher_is_better",
            "trend": [],
            "by_plant":          _percent_breakdown(po_df, plant_col,  rc_flag),
            "by_vendor":         _percent_breakdown(po_df, vendor_col, rc_flag),
            "by_category":       _percent_breakdown(po_df, cat_col,    rc_flag),
            "by_purchase_group": _percent_breakdown(po_df, pg_col,     rc_flag),
        }
        return (vol_kpi, val_kpi)
    except Exception as e:
        print(f"[kpi_rc] ERROR: {e}")
        return ({"available": False}, {"available": False})


def _kpi_supplier_otd(po_df, col_map, params=None):
    try:
        gr_col = _get_po_col(po_df, "gr_date", col_map)
        del_col = _get_po_col(po_df, "pr_delivery_date", col_map)
        if not gr_col or not del_col:
            return {"id": "supplier_otd", "label": "Supplier OTD", "available": False, "value": None,
                    "unit": "%", "benchmark": 85, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        tmp = po_df[[gr_col, del_col]].copy()
        tmp["gr"] = pd.to_datetime(tmp[gr_col], errors="coerce")
        tmp["del"] = pd.to_datetime(tmp[del_col], errors="coerce")
        tmp = tmp.dropna()
        grace = (params or {}).get("grace_period_days", 0)
        on_time = (tmp["gr"] <= tmp["del"] + pd.Timedelta(days=grace))
        otd_pct = round(float(on_time.mean() * 100), 1) if len(tmp) > 0 else None
        # Project the on-time mask back onto the original po_df indexes so the
        # breakdown helpers can group by plant/vendor/category. Rows missing
        # GR/Delivery dates count as 'not on time' for the breakdown — they
        # already drop out of the headline mean.
        po_with_flag = po_df.assign(_otd_flag=False)
        po_with_flag.loc[tmp.index, "_otd_flag"] = on_time.values
        plant_col  = _get_po_col(po_df, "plant",          col_map)
        cat_col    = _get_po_col(po_df, "material_group", col_map)
        vendor_col = _get_po_col(po_df, "vendor",         col_map)
        pg_col     = _get_po_col(po_df, "purchase_group", col_map)
        on_time_only = po_with_flag.loc[tmp.index]
        return {
            "id": "supplier_otd", "label": "Supplier OTD", "available": otd_pct is not None,
            "value": otd_pct, "unit": "%", "benchmark": 85, "direction": "higher_is_better",
            "trend": [],
            "by_plant":          _percent_breakdown(on_time_only, plant_col,  on_time_only["_otd_flag"]),
            "by_vendor":         _percent_breakdown(on_time_only, vendor_col, on_time_only["_otd_flag"]),
            "by_category":       _percent_breakdown(on_time_only, cat_col,    on_time_only["_otd_flag"]),
            "by_purchase_group": _percent_breakdown(on_time_only, pg_col,     on_time_only["_otd_flag"]),
            "confidence": "high" if len(tmp) >= 50 else "medium",
        }
    except Exception as e:
        return {"id": "supplier_otd", "label": "Supplier OTD", "available": False, "value": None,
                "unit": "%", "benchmark": 85, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_savings_lpo(po_df, col_map):
    import numpy as np
    try:
        price_col = next((c for c in ["net price","net_price"] if c in po_df.columns), None)
        lpo_col   = next((c for c in ["last po price","last_po_price"] if c in po_df.columns), None)
        if not price_col or not lpo_col:
            return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        tmp = po_df[[price_col, lpo_col]].copy()
        tmp["price"] = pd.to_numeric(tmp[price_col], errors="coerce")
        tmp["lpo"]   = pd.to_numeric(tmp[lpo_col], errors="coerce")
        tmp = tmp.dropna()
        tmp = tmp[tmp["lpo"] > 0]
        if len(tmp) == 0:
            return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        savings_pct = ((tmp["lpo"] - tmp["price"]) / tmp["lpo"] * 100)
        lo, hi = np.percentile(savings_pct, [5, 95])
        savings_pct = savings_pct[(savings_pct >= lo) & (savings_pct <= hi)]
        avg_savings = round(float(savings_pct.mean()), 1) if len(savings_pct) > 0 else None
        # By-dim breakdowns: average savings_pct per group (size ≥ 5).
        plant_col  = _get_po_col(po_df, "plant",          col_map)
        cat_col    = _get_po_col(po_df, "material_group", col_map)
        vendor_col = _get_po_col(po_df, "vendor",         col_map)
        pg_col     = _get_po_col(po_df, "purchase_group", col_map)
        view = po_df.loc[tmp.index].assign(_savings=savings_pct.reindex(tmp.index))
        view = view.dropna(subset=["_savings"])
        def _grp_mean(col):
            if not col or col not in view.columns: return []
            grp = view.groupby(col)["_savings"].agg(["mean", "size"])
            grp = grp[grp["size"] >= 5].sort_values("size", ascending=False).head(10)
            return [{"name": str(name), "value": round(float(row["mean"]), 1), "n": int(row["size"])}
                    for name, row in grp.iterrows()]
        return {
            "id": "savings_lpo", "label": "Savings over LPO", "available": avg_savings is not None,
            "value": avg_savings, "unit": "%", "benchmark": 5, "direction": "higher_is_better",
            "trend": [],
            "by_plant":          _grp_mean(plant_col),
            "by_vendor":         _grp_mean(vendor_col),
            "by_category":       _grp_mean(cat_col),
            "by_purchase_group": _grp_mean(pg_col),
        }
    except Exception as e:
        return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_pac_prs(po_df, pr_df, col_map):
    """Single-source / PAC PRs % — PRs with a pre-assigned vendor."""
    try:
        if pr_df is None or pr_df.empty:
            return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        vendor_col = next((c for c in ["Preferred_Vendor","Fixed_Vendor","pr_vendor","Vendor"] if c in pr_df.columns), None)
        if not vendor_col:
            return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        has_vendor = pr_df[vendor_col].notna() & (pr_df[vendor_col].astype(str).str.strip() != "")
        pac_pct = round(float(has_vendor.mean() * 100), 1)
        # Breakdown KPIs are most informative split by Plant / Material Group
        # / Cost Centre — pull whatever's available on the PR file.
        pr_plant_col = next((c for c in ["Plant","plant"] if c in pr_df.columns), None)
        pr_cat_col   = next((c for c in ["Material_Group","material_group"] if c in pr_df.columns), None)
        pr_cc_col    = next((c for c in ["Cost_Center","cost_center","CostCenter"] if c in pr_df.columns), None)
        return {
            "id": "pac_prs", "label": "Single-Source PRs", "available": True,
            "value": pac_pct, "unit": "%", "benchmark": 5, "direction": "lower_is_better",
            "trend": [],
            "by_plant":          _percent_breakdown(pr_df, pr_plant_col, has_vendor),
            "by_vendor":         _percent_breakdown(pr_df, vendor_col,    has_vendor),
            "by_category":       _percent_breakdown(pr_df, pr_cat_col,   has_vendor),
            "by_purchase_group": _percent_breakdown(pr_df, pr_cc_col,    has_vendor),
        }
    except Exception as e:
        return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_emergency_prs(pr_df, col_map):
    try:
        if pr_df is None or pr_df.empty:
            return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 10, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        type_col = next((c for c in ["PR_Type","Priority","Urgency","Document_Type","pr_type"] if c in pr_df.columns), None)
        if not type_col:
            return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 10, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        urgent_keywords = ["emergency","urgent","rush","express","undef","immediate","hot"]
        is_emerg = pr_df[type_col].astype(str).str.lower().apply(
            lambda v: any(k in v for k in urgent_keywords)
        )
        pct = round(float(is_emerg.mean() * 100), 1)
        pr_plant_col = next((c for c in ["Plant","plant"] if c in pr_df.columns), None)
        pr_cat_col   = next((c for c in ["Material_Group","material_group"] if c in pr_df.columns), None)
        pr_creator   = next((c for c in ["PR_Creator","Created_By","Requestor"] if c in pr_df.columns), None)
        pr_cc_col    = next((c for c in ["Cost_Center","cost_center"] if c in pr_df.columns), None)
        return {
            "id": "emergency_prs", "label": "Emergency PRs", "available": True,
            "value": pct, "unit": "%", "benchmark": 10, "direction": "lower_is_better",
            "trend": [],
            "by_plant":          _percent_breakdown(pr_df, pr_plant_col, is_emerg),
            "by_vendor":         _percent_breakdown(pr_df, pr_creator,   is_emerg),
            "by_category":       _percent_breakdown(pr_df, pr_cat_col,   is_emerg),
            "by_purchase_group": _percent_breakdown(pr_df, pr_cc_col,    is_emerg),
        }
    except Exception as e:
        return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                "unit": "%", "benchmark": 10, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_tail_spend(po_df, col_map, threshold_pct=1.0):
    try:
        vendor_col = _get_po_col(po_df, "vendor", col_map)
        nv_col = _get_po_col(po_df, "net_value", col_map)
        if not vendor_col or not nv_col:
            return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                    "benchmark": 20, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        nv = pd.to_numeric(po_df[nv_col], errors="coerce").fillna(0)
        total_spend = nv.sum()
        if total_spend == 0:
            return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                    "benchmark": 20, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        vendor_spend = po_df.assign(_nv=nv).groupby(vendor_col)["_nv"].sum().sort_values(ascending=False)
        n_vendors = len(vendor_spend)
        # Two definitions, take the more conservative (lower tail %):
        #   (a) vendors below `threshold_pct` of total spend (legacy)
        #   (b) vendors past the top 20% by rank (Pareto cut)
        # On wide vendor bases (1000s of suppliers), (a) marks almost everyone
        # as tail because each vendor is < threshold_pct individually. (b)
        # keeps the result anchored to the spend-concentration story even when
        # the supplier count gets very large.
        vendor_pct = vendor_spend / total_spend * 100
        tail_mask_a = vendor_pct < threshold_pct
        n_top = max(1, int(n_vendors * 0.2))
        tail_mask_b = pd.Series([False] * n_vendors, index=vendor_spend.index)
        tail_mask_b.iloc[n_top:] = True
        # Use (b) when (a) classifies > 95% of vendors as tail (broken on
        # wide bases). Otherwise use (a).
        tail_mask = tail_mask_a if tail_mask_a.mean() < 0.95 else tail_mask_b
        tail_spend = vendor_spend[tail_mask].sum()
        tail_pct = round(float(tail_spend / total_spend * 100), 1)
        # Per-vendor tail-spend share — the "by_vendor" breakdown lists the
        # bottom-most vendors by spend. Surfaces who's actually the tail.
        tail_vendors_top = vendor_spend[tail_mask].sort_values(ascending=False).head(15)
        by_vendor_tail = [
            {"name": str(v), "value": round(float(s) / 1e7, 2), "pct": round(float(s) / total_spend * 100, 2)}
            for v, s in tail_vendors_top.items()
        ]
        plant_col = _get_po_col(po_df, "plant",          col_map)
        cat_col   = _get_po_col(po_df, "material_group", col_map)
        pg_col    = _get_po_col(po_df, "purchase_group", col_map)
        # Per-plant / per-category — total tail spend share within that group
        def _tail_share_by(col):
            if not col or col not in po_df.columns: return []
            tail_vendor_set = set(vendor_spend[tail_mask].index)
            view = po_df[[col, vendor_col]].assign(_nv=nv)
            view["_is_tail"] = view[vendor_col].isin(tail_vendor_set)
            agg = view.groupby(col).agg(total=("_nv", "sum"), tail=("_nv", lambda s: s.where(view.loc[s.index, "_is_tail"]).sum()))
            agg = agg[agg["total"] > 0].sort_values("total", ascending=False).head(10)
            return [{"name": str(name), "value": round(float(row["tail"] / row["total"] * 100), 1), "pct": round(float(row["tail"] / row["total"] * 100), 1)}
                    for name, row in agg.iterrows()]
        return {
            "id": "tail_spend_pct", "label": "Tail Spend %", "available": True,
            "value": tail_pct, "unit": "%", "benchmark": 20, "direction": "lower_is_better",
            "trend": [],
            "by_plant":          _tail_share_by(plant_col),
            "by_vendor":         by_vendor_tail,
            "by_category":       _tail_share_by(cat_col),
            "by_purchase_group": _tail_share_by(pg_col),
        }
    except Exception as e:
        return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                "benchmark": 20, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _compute_kpi_dashboard(session_id: str, plant: str = "", category: str = "",
                            purchase_group: str = "", date_from: str = "", date_to: str = "") -> dict:
    """Main dashboard computation — called by the GET endpoint and by AI insights."""
    sess = get_session(session_id)
    dfs = sess.get("dataframes", {})
    col_map = sess.get("final_col_map") or {}
    engagement = sess.get("engagement") or {}

    po_df = dfs.get("po_df")
    pr_df = dfs.get("pr_df") if dfs.get("pr_df") is not None else pd.DataFrame()
    if po_df is None:
        raise ValueError("No PO data in session")

    po_f = po_df.copy()
    pr_f = pr_df.copy() if not pr_df.empty else pr_df

    nv_col = _get_po_col(po_f, "net_value", col_map)
    plant_col = _get_po_col(po_f, "plant", col_map)
    cat_col = _get_po_col(po_f, "material_group", col_map)
    pg_col = _get_po_col(po_f, "purchase_group", col_map)
    date_col = _get_po_col(po_f, "po_date", col_map)

    if plant and plant_col and plant in po_f[plant_col].values: po_f = po_f[po_f[plant_col] == plant]
    if category and cat_col and category in po_f[cat_col].values: po_f = po_f[po_f[cat_col] == category]
    if purchase_group and pg_col and purchase_group in po_f[pg_col].values: po_f = po_f[po_f[pg_col] == purchase_group]
    if date_from and date_col:
        try:
            po_f[date_col] = pd.to_datetime(po_f[date_col], errors="coerce")
            po_f = po_f[po_f[date_col] >= pd.to_datetime(date_from)]
        except Exception: pass
    if date_to and date_col:
        try:
            po_f = po_f[po_f[date_col] <= pd.to_datetime(date_to)]
        except Exception: pass

    rc_vol, rc_val = _kpi_rc_adoption(po_f, col_map)
    kpis = {
        "tat_pr_to_po":       _kpi_tat_pr_to_po(po_f, pr_f, col_map),
        "rc_adoption_volume": rc_vol,
        "rc_adoption_value":  rc_val,
        "supplier_otd":       _kpi_supplier_otd(po_f, col_map),
        "savings_lpo":        _kpi_savings_lpo(po_f, col_map),
        "pac_prs":            _kpi_pac_prs(po_f, pr_f, col_map),
        "emergency_prs":      _kpi_emergency_prs(pr_f, col_map),
        "tail_spend_pct":     _kpi_tail_spend(po_f, col_map),
    }

    total_spend_cr = 0.0
    if nv_col:
        nv = pd.to_numeric(po_f[nv_col], errors="coerce").fillna(0)
        total_spend_cr = _to_cr(float(nv.sum()))
        fte = engagement.get("fte_count")
        spend_per_fte = round(total_spend_cr / fte, 2) if fte and fte > 0 else None
        kpis["spend_per_fte"] = {
            "id": "spend_per_fte", "label": "Spend per FTE",
            "available": spend_per_fte is not None, "value": spend_per_fte,
            "unit": "₹ Cr", "benchmark": 18, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
        vendor_col = _get_po_col(po_f, "vendor", col_map)
        by_vendor = []
        if vendor_col:
            vend_spend = po_f.assign(_nv=nv).groupby(vendor_col)["_nv"].sum().sort_values(ascending=False)
            total = float(vend_spend.sum())
            by_vendor = [
                {"name": str(v), "value": round(_to_cr(float(s)), 2),
                 "pct": round(float(s/total*100), 1) if total > 0 else 0}
                for v, s in vend_spend.head(20).items()
            ]
        kpis["proc_spend"] = {
            "id": "proc_spend", "label": "Procurement Spend",
            "available": True, "value": round(total_spend_cr, 2),
            "unit": "₹ Cr", "benchmark": None, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": by_vendor, "by_category": [], "by_purchase_group": [],
        }

    vendor_col = _get_po_col(po_f, "vendor", col_map)
    if vendor_col and nv_col:
        nv = pd.to_numeric(po_f[nv_col], errors="coerce").fillna(0)
        vend_spend = po_f.assign(_nv=nv).groupby(vendor_col)["_nv"].sum().sort_values(ascending=False)
        total = float(vend_spend.sum())
        if total > 0:
            n_top20 = max(1, int(len(vend_spend) * 0.2))
            top20_pct = round(float(vend_spend.head(n_top20).sum() / total * 100), 1)
            kpis["pareto_vendors"] = {
                "id": "pareto_vendors", "label": "Pareto Vendor Concentration",
                "available": True, "value": top20_pct,
                "unit": "%", "benchmark": 65, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
            }

    po_count = len(po_f)
    vendor_count = int(po_f[vendor_col].nunique()) if vendor_col else 0
    date_range = None
    if date_col:
        try:
            dates = pd.to_datetime(po_f[date_col], errors="coerce").dropna()
            if len(dates) > 0:
                date_range = {"min": str(dates.min().date()), "max": str(dates.max().date())}
        except Exception: pass

    summary = {"total_spend_cr": round(total_spend_cr, 2), "po_count": po_count,
               "vendor_count": vendor_count, "date_range": date_range}

    filters = {
        "plants": sorted(po_df[plant_col].dropna().unique().tolist()) if plant_col else [],
        "categories": sorted(po_df[cat_col].dropna().unique().tolist()) if cat_col else [],
        "purchase_groups": sorted(po_df[pg_col].dropna().unique().tolist()) if pg_col else [],
    }

    return {
        "kpis": kpis,
        "summary": summary,
        "filters": filters,
        "low_confidence": po_count < 50,
        "row_count": po_count,
    }


@router.get("/session/{session_id}/results/kpi-dashboard")
def get_kpi_dashboard(
    session_id: str,
    plant: str = "", category: str = "", purchase_group: str = "",
    date_from: str = "", date_to: str = "",
):
    try:
        return _compute_kpi_dashboard(session_id, plant, category, purchase_group, date_from, date_to)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
