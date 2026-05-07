from __future__ import annotations
import math
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from serializers import (
    serialize_dimension_result, serialize_overall_result,
    serialize_kpi_assessment, serialize_insight_card, serialize_diagnostic,
)
from session_store import get_session

router = APIRouter(tags=["results"])


def _build_swimlane_from_s2p(path, gap_list):
    """Build swimlane HTML from S2P process file with optional gap highlights."""
    try:
        df = pd.read_excel(path)
        rows_html = []
        for _, row in df.iterrows():
            cells = "".join(f"<td style='padding:6px;border:1px solid #ccc'>{v}</td>" for v in row.values)
            rows_html.append(f"<tr>{cells}</tr>")
        header = "".join(f"<th style='padding:8px;background:#460073;color:white'>{c}</th>" for c in df.columns)
        return f"<table style='border-collapse:collapse;width:100%'><thead><tr>{header}</tr></thead><tbody>{''.join(rows_html)}</tbody></table>"
    except Exception as e:
        return f"<p>Could not load S2P: {e}</p>"


@router.get("/session/{session_id}/results")
def get_results(session_id: str):
    sess = get_session(session_id)
    overall = sess.get("overall_result")
    if overall is None:
        raise HTTPException(status_code=404, detail="Assessment not run yet.")
    dim_results = sess.get("dim_results", [])
    kpi_assessment = sess.get("kpi_assessment")
    overall_serialised = serialize_overall_result(overall)
    # Score reconciliation: KPI score is canonical for procurement
    if kpi_assessment is not None:
        kpi_score = getattr(kpi_assessment, "overall_score", None)
        kpi_label = getattr(kpi_assessment, "overall_label", None)
        if kpi_score is not None:
            overall_serialised["score"] = kpi_score
            overall_serialised["level"] = kpi_label or overall_serialised.get("level")
            overall_serialised["dimension_score"] = getattr(overall, "score", None)
    return {
        "engagement": sess.get("engagement", {}),
        "overall": overall_serialised,
        "dimension_results": [serialize_dimension_result(dr) for dr in dim_results],
        "kpi_assessment": serialize_kpi_assessment(kpi_assessment),
    }


@router.get("/session/{session_id}/results/organogram")
def get_organogram(session_id: str, model: str = "Centralised", fte: int = 20):
    sess = get_session(session_id)
    try:
        from engine.organogram import build_organogram_html
        html = build_organogram_html(model, fte)
        return {"html": html}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/results/swimlane")
def get_swimlane(session_id: str, kpi_gaps: str = ""):
    from pathlib import Path
    import os
    gap_list = [g.strip() for g in kpi_gaps.split(",") if g.strip()] if kpi_gaps else []
    s2p_candidates = [
        Path(os.environ.get("S2P_PROCESS_PATH", "x_not_set")),
        Path(__file__).parent.parent.parent / "Process file" / "S2P_Process_L1_L5_RACI.xlsx",
    ]
    for p in s2p_candidates:
        if p and p.exists():
            try:
                html = _build_swimlane_from_s2p(p, gap_list)
                return {"html": html}
            except Exception: pass
    return {"html": "<p>Process map not available — place S2P_Process_L1_L5_RACI.xlsx in Process file/</p>"}


@router.get("/session/{session_id}/results/swimlane-interactive")
def get_swimlane_interactive(session_id: str):
    return get_swimlane(session_id)


@router.get("/session/{session_id}/results/org-recommendation")
def get_org_recommendation(session_id: str):
    sess = get_session(session_id)
    engagement = sess.get("engagement") or {}
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    fte = engagement.get("fte_count")
    annual_spend = engagement.get("annual_spend")
    model = "Centralised"
    signals = []
    plant_count = 1
    if po_df is not None:
        from routers.kpi_dashboard import _get_po_col
        plant_col = _get_po_col(po_df, "plant", col_map)
        if plant_col: plant_count = int(po_df[plant_col].nunique())
    if plant_count > 5: model = "Hybrid"; signals.append(f"{plant_count} plants — decentralised ops signal")
    else: signals.append(f"{plant_count} plant(s) — centralised model fits")
    if fte and annual_spend:
        spend_per_fte = annual_spend / fte
        if spend_per_fte < 10: model = "Centralised"; signals.append(f"₹{spend_per_fte:.0f} Cr/FTE — below benchmark, centralise")
        else: signals.append(f"₹{spend_per_fte:.0f} Cr/FTE — meets benchmark")
    fte_range = f"{max(1, int((fte or 20) * 0.8))}–{int((fte or 20) * 1.2)}" if fte else "15–25"
    return {"model": model, "signals": signals, "fte_range": fte_range}


@router.get("/session/{session_id}/results/buying-channel")
def get_buying_channel(session_id: str):
    sess = get_session(session_id)
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    if po_df is None:
        return {"rows": [], "summary": {"total_mgs": 0, "classified": 0}}
    try:
        from routers.kpi_dashboard import _get_po_col
        import pandas as pd
        mg_col  = _get_po_col(po_df, "material_group", col_map)
        nv_col  = _get_po_col(po_df, "net_value", col_map)
        rc_col  = next((c for c in ["agreement","Outline_Agreement","Contract_Number"] if c in po_df.columns), None)
        mt_col  = _get_po_col(po_df, "material_type", col_map)
        desc_col = _get_po_col(po_df, "material_group_desc", col_map)
        rows = []
        if mg_col and nv_col:
            agg = po_df.groupby(mg_col).agg(
                spend=(nv_col, lambda x: pd.to_numeric(x, errors="coerce").sum()),
                po_count=(nv_col, "count"),
            ).reset_index()
            agg["spend_cr"] = agg["spend"] / 1e7
            total_spend = agg["spend"].sum()
            agg["spend_pct"] = agg["spend"] / total_spend * 100 if total_spend > 0 else 0
            if rc_col:
                rc_rate = po_df.groupby(mg_col).apply(
                    lambda g: (g[rc_col].notna() & (g[rc_col].astype(str).str.strip() != "")).mean() * 100
                ).rename("rc_rate")
                agg = agg.merge(rc_rate, on=mg_col, how="left")
            else: agg["rc_rate"] = 0
            if desc_col:
                desc_map = po_df.groupby(mg_col)[desc_col].first().to_dict()
                agg["desc"] = agg[mg_col].map(desc_map).fillna("")
            else: agg["desc"] = ""
            def _classify(row):
                rc = row.get("rc_rate", 0) or 0
                spend = row.get("spend_cr", 0) or 0
                if rc >= 60: ch = "Contracts"; conf = "HIGH" if rc >= 80 else "MEDIUM"
                elif spend > 50: ch = "RFQ"; conf = "MEDIUM"
                else: ch = "Open RFQ"; conf = "LOW"
                arch = "BULK" if spend > 20 else "INDIRECT" if spend > 5 else "NON-CRITICAL"
                tat_map = {"Contracts": 3, "RFQ": 25, "Open RFQ": 60}
                return ch, arch, conf, tat_map.get(ch, 45), tat_map.get("Contracts", 3)
            for _, row in agg.iterrows():
                ch, arch, conf, asis_tat, tobe_tat = _classify(row)
                rows.append({
                    "mg_code": row[mg_col], "mg_desc": row["desc"],
                    "archetype": arch, "current_channel": ch, "recommended_channel": ch,
                    "confidence": conf,
                    "spend_cr": round(float(row["spend_cr"]), 2),
                    "spend_pct": round(float(row["spend_pct"]), 2),
                    "po_count": int(row["po_count"]),
                    "asis_tat": asis_tat, "tobe_tat": tobe_tat,
                    "signal": f"RC coverage: {row.get('rc_rate',0):.0f}%",
                })
        return {"rows": sorted(rows, key=lambda r: r["spend_cr"], reverse=True),
                "summary": {"total_mgs": len(rows), "classified": sum(1 for r in rows if r["confidence"] != "LOW")}}
    except Exception as e:
        return {"rows": [], "summary": {"total_mgs": 0, "classified": 0}, "error": str(e)}


@router.get("/session/{session_id}/results/value-tree")
def get_value_tree(session_id: str):
    """Return channel-mix data for AS-IS vs TO-BE TAT analysis."""
    sess = get_session(session_id)
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    if po_df is None:
        return {"asis": {"rc_pct": 40, "asl_pct": 30, "rfq_pct": 30, "weighted_tat": 52},
                "tobe": {"rc_pct": 60, "asl_pct": 25, "rfq_pct": 15, "weighted_tat": 28}}
    try:
        from routers.kpi_dashboard import _get_po_col, _kpi_rc_adoption
        rc_vol, _ = _kpi_rc_adoption(po_df, col_map)
        rc_pct = float(rc_vol.get("value", 40)) if rc_vol and rc_vol.get("available") else 40
        asl_pct = max(0, min(80, 100 - rc_pct - 20))
        rfq_pct = max(0, 100 - rc_pct - asl_pct)
        weighted_tat = (rc_pct * 3 + asl_pct * 25 + rfq_pct * 60) / 100
        tobe_rc = min(95, rc_pct + 20)
        tobe_asl = max(0, asl_pct - 5)
        tobe_rfq = max(0, 100 - tobe_rc - tobe_asl)
        tobe_tat = (tobe_rc * 3 + tobe_asl * 25 + tobe_rfq * 60) / 100
        return {
            "asis": {"rc_pct": round(rc_pct), "asl_pct": round(asl_pct), "rfq_pct": round(rfq_pct), "weighted_tat": round(weighted_tat)},
            "tobe": {"rc_pct": round(tobe_rc), "asl_pct": round(tobe_asl), "rfq_pct": round(tobe_rfq), "weighted_tat": round(tobe_tat)},
        }
    except Exception as e:
        return {"asis": {"rc_pct": 40, "asl_pct": 30, "rfq_pct": 30, "weighted_tat": 52},
                "tobe": {"rc_pct": 60, "asl_pct": 25, "rfq_pct": 15, "weighted_tat": 28}}


@router.get("/session/{session_id}/results/ai-usecases")
def get_ai_usecases(session_id: str):
    """Return AI use-cases matched to assessment gaps."""
    sess = get_session(session_id)
    kpi_assessment = sess.get("kpi_assessment")
    use_cases = [
        {"title": "Intelligent PO Auto-Approval", "description": "AI-driven rule engine automatically approves low-risk POs below threshold value, reducing TAT by 40%.", "relevant_kpis": ["tat","pac_prs"], "maturity_required": "Intermediate", "effort": "Medium", "benefit": "Reduce approval TAT by 40%"},
        {"title": "Rate Contract Coverage Optimiser", "description": "ML model identifies spend categories with RC coverage gaps and recommends contract expansion priorities.", "relevant_kpis": ["rc_adoption","savings_lpo"], "maturity_required": "Advanced", "effort": "High", "benefit": "Increase RC adoption by 15-20%"},
        {"title": "Vendor Risk Scoring Engine", "description": "Real-time vendor risk scores from financial, delivery, and quality data feed into sourcing decisions.", "relevant_kpis": ["otd","defect_rate"], "maturity_required": "Intermediate", "effort": "High", "benefit": "Reduce supply disruptions by 30%"},
        {"title": "Spend Anomaly Detection", "description": "Unsupervised ML flags unusual spending patterns, maverick buying, and policy violations in real-time.", "relevant_kpis": ["pac_prs","emergency_prs"], "maturity_required": "Foundation", "effort": "Low", "benefit": "Detect 85% of compliance issues automatically"},
        {"title": "Savings Leakage Predictor", "description": "Model predicts which negotiated savings are at risk of leakage at point of PO creation.", "relevant_kpis": ["savings_lpo","rc_adoption"], "maturity_required": "Advanced", "effort": "Medium", "benefit": "Recover 2-3% of contracted savings"},
        {"title": "Smart Category Intelligence", "description": "NLP engine processes supplier proposals, market reports, and price indices to surface category insights.", "relevant_kpis": ["savings_lpo"], "maturity_required": "Advanced", "effort": "High", "benefit": "Improve sourcing outcomes by 8-12%"},
    ]
    if kpi_assessment:
        for uc in use_cases:
            kpi_results = getattr(kpi_assessment, "kpi_results", {}) or {}
            uc["is_relevant"] = any(
                kpi_results.get(kid) and getattr(kpi_results[kid], "score", 5) <= 2
                for kid in uc["relevant_kpis"]
            )
    return {"use_cases": use_cases}


@router.get("/session/{session_id}/results/report")
def download_report(session_id: str):
    sess = get_session(session_id)
    rb = sess.get("report_bytes")
    if rb is None:
        raise HTTPException(status_code=404, detail="No report generated yet.")
    return Response(
        content=rb,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="Assessment_Report.xlsx"'},
    )
