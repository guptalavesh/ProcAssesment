from __future__ import annotations
import io
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["ppt_export"])

# ── Workstream catalogue (proposal deck) ─────────────────────────────────────
WORKSTREAMS = [
    {"id": "op_model",    "title": "Operating Model & Organisation",     "colour": "#a100ff"},
    {"id": "process",     "title": "Process Design & Optimisation",      "colour": "#7500c0"},
    {"id": "category",    "title": "Category & Channel Optimisation",    "colour": "#460073"},
    {"id": "cost_takeout","title": "Cost Takeout Programme",             "colour": "#0070c0"},
    {"id": "tech",        "title": "Digital Procurement Technology",     "colour": "#00b0f0"},
    {"id": "srm",         "title": "Supplier Relationship Management",   "colour": "#00b050"},
    {"id": "capability",  "title": "Capability Building & Change Mgmt",  "colour": "#ff7c00"},
    {"id": "data",        "title": "Data & Analytics Foundation",        "colour": "#ffc000"},
]


def _new_pptx():
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    return Presentation(), Inches, Pt, RGBColor


def _add_title_slide(prs, Inches, Pt, RGBColor, title: str, subtitle: str = ""):
    blank = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank)
    from pptx.util import Inches as I
    tx = slide.shapes.add_textbox(I(0.5), I(2.5), I(9), I(1.5)).text_frame
    p = tx.paragraphs[0]
    p.text = title
    p.runs[0].font.size = Pt(40)
    p.runs[0].font.bold = True
    p.runs[0].font.color.rgb = RGBColor(0x46, 0x00, 0x73)
    if subtitle:
        sub = tx.add_paragraph()
        sub.text = subtitle
        sub.runs[0].font.size = Pt(20)
        sub.runs[0].font.color.rgb = RGBColor(0x75, 0x00, 0xc0)
    return slide


def _add_text_slide(prs, Inches, Pt, RGBColor, title: str, lines: List[str]):
    blank = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank)
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    tf.text = title
    tf.paragraphs[0].runs[0].font.size = Pt(28)
    tf.paragraphs[0].runs[0].font.bold = True
    tf.paragraphs[0].runs[0].font.color.rgb = RGBColor(0x46, 0x00, 0x73)
    body_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.3), Inches(9), Inches(5.5))
    body_tf = body_box.text_frame
    body_tf.word_wrap = True
    for i, line in enumerate(lines):
        p = body_tf.paragraphs[0] if i == 0 else body_tf.add_paragraph()
        p.text = f"• {line}"
        p.runs[0].font.size = Pt(14)
        p.runs[0].font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    return slide


@router.get("/session/{session_id}/results/export/ppt")
def export_kpi_ppt(session_id: str):
    """KPI Dashboard Deck — 13 slides."""
    sess = get_session(session_id)
    overall = sess.get("overall_result")
    kpi_assessment = sess.get("kpi_assessment")
    engagement = sess.get("engagement", {})
    if overall is None:
        raise HTTPException(status_code=400, detail="No assessment results — run pipeline first.")
    try:
        prs, Inches, Pt, RGBColor = _new_pptx()
        client = engagement.get("client_name", "Client")
        date = engagement.get("date", "")
        _add_title_slide(prs, Inches, Pt, RGBColor,
                         f"{client} — Procurement Maturity Assessment",
                         f"Accenture | {date}")
        score = getattr(overall, "score", None) or "—"
        level = getattr(overall, "level", None) or ""
        _add_text_slide(prs, Inches, Pt, RGBColor, "Executive Summary",
                        [f"Overall maturity: {score} ({level})",
                         f"Scored dimensions: {getattr(overall,'scored_dims',0)} / {getattr(overall,'total_dims',0)}",
                         f"Active weight: {getattr(overall,'active_weight_pct',None)}%"])
        if kpi_assessment is not None:
            kpi_lines = []
            for kid, kr in (getattr(kpi_assessment, "kpi_results", {}) or {}).items():
                kpi_lines.append(f"{getattr(kr,'label','')}: {getattr(kr,'actual','—')} (bench {getattr(kr,'benchmark','—')})")
            _add_text_slide(prs, Inches, Pt, RGBColor, "KPI Scorecard", kpi_lines[:14])
        for bucket in ["Efficiency", "Effectiveness", "Vendor Management", "Risk"]:
            _add_text_slide(prs, Inches, Pt, RGBColor, f"{bucket} Bucket", [f"{bucket} bucket details — see full report."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Spend Analysis", ["Vendor pareto, category mix, plant split."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Root Cause Analysis", ["Top RCAs derived from KPI gaps."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Priority Actions", ["Action 1", "Action 2", "Action 3", "Action 4"])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Quick Wins", ["Quick win 1", "Quick win 2"])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Recommended Offerings", ["Procurement transformation services."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Appendix — Data Sources",
                        [f"PO rows: {len(sess['dataframes'].get('po_df') or [])}",
                         f"PR rows: {len(sess['dataframes'].get('pr_df') or [])}",
                         "QRE answers logged in session."])
        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return StreamingResponse(out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{client}_KPI_Dashboard.pptx"'})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/results/export/ppt/proposal")
def export_proposal_ppt(session_id: str):
    """Transformation Proposal Deck — 18 slides."""
    sess = get_session(session_id)
    engagement = sess.get("engagement", {})
    try:
        prs, Inches, Pt, RGBColor = _new_pptx()
        client = engagement.get("client_name", "Client")
        _add_title_slide(prs, Inches, Pt, RGBColor,
                         f"{client} — Procurement Transformation Proposal",
                         "Accenture")
        _add_text_slide(prs, Inches, Pt, RGBColor, "Current State", ["Maturity baseline established."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Gap Analysis", ["Bucket-level gap analysis."])
        for ws in WORKSTREAMS:
            _add_text_slide(prs, Inches, Pt, RGBColor, f"Workstream: {ws['title']}", ["Scope, deliverables, outcomes."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Programme Roadmap", ["Phase 1 — 0-3m", "Phase 2 — 3-6m", "Phase 3 — 6-12m"])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Investment Estimate", ["Total programme cost & ROI."])
        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return StreamingResponse(out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{client}_Transformation_Proposal.pptx"'})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TimelinePayload(BaseModel):
    duration: str = "12m"  # 90d, 6m, 12m
    include_slides: Dict[str, bool] = {}


@router.get("/session/{session_id}/program-timeline")
def get_program_timeline(session_id: str):
    sess = get_session(session_id)
    return sess.get("program_timeline") or {"duration": "12m", "include_slides": {}}


@router.post("/session/{session_id}/program-timeline")
def save_program_timeline(session_id: str, payload: TimelinePayload):
    sess = get_session(session_id)
    sess["program_timeline"] = {"duration": payload.duration, "include_slides": payload.include_slides}
    return {"ok": True}


@router.get("/workstreams")
def get_workstreams():
    return {"workstreams": WORKSTREAMS}
