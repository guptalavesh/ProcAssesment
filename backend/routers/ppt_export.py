from __future__ import annotations
import io
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["ppt_export"])


# ── AIVault palette (used for slide accents) ─────────────────────────────────
_COBALT       = (0x22, 0x51, 0xFF)
_COBALT_DARK  = (0x16, 0x32, 0xB0)
_NEUTRAL_900  = (0x0F, 0x14, 0x1C)
_NEUTRAL_500  = (0x64, 0x70, 0x8A)


# ── Workstream catalogue (proposal deck) ─────────────────────────────────────
# Colours are AIVault cobalt-ish accents — kept as hex for the JSON endpoint.
WORKSTREAMS = [
    {"id": "op_model",    "title": "Operating Model & Organisation",     "colour": "#2251FF"},
    {"id": "process",     "title": "Process Design & Optimisation",      "colour": "#1A41E0"},
    {"id": "category",    "title": "Category & Channel Optimisation",    "colour": "#1632B0"},
    {"id": "cost_takeout","title": "Cost Takeout Programme",             "colour": "#102484"},
    {"id": "tech",        "title": "Digital Procurement Technology",     "colour": "#039855"},
    {"id": "srm",         "title": "Supplier Relationship Management",   "colour": "#1570EF"},
    {"id": "capability",  "title": "Capability Building & Change Mgmt",  "colour": "#DC6803"},
    {"id": "data",        "title": "Data & Analytics Foundation",        "colour": "#7E92FF"},
]


def _g(o, k, default=None):
    if o is None: return default
    if hasattr(o, k): return getattr(o, k)
    if isinstance(o, dict): return o.get(k, default)
    return default


def _new_pptx():
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    return Presentation(), Inches, Pt, RGBColor


def _add_title_slide(prs, Inches, Pt, RGBColor, title: str, subtitle: str = ""):
    blank = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank)
    tx = slide.shapes.add_textbox(Inches(0.5), Inches(2.5), Inches(9), Inches(1.5)).text_frame
    p = tx.paragraphs[0]
    p.text = title
    p.runs[0].font.size = Pt(40)
    p.runs[0].font.bold = True
    p.runs[0].font.color.rgb = RGBColor(*_NEUTRAL_900)
    if subtitle:
        sub = tx.add_paragraph()
        sub.text = subtitle
        sub.runs[0].font.size = Pt(20)
        sub.runs[0].font.color.rgb = RGBColor(*_COBALT)
    return slide


def _add_text_slide(prs, Inches, Pt, RGBColor, title: str, lines: List[str]):
    blank = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank)
    title_box = slide.shapes.add_textbox(Inches(0.5), Inches(0.4), Inches(9), Inches(0.8))
    tf = title_box.text_frame
    tf.text = title
    tf.paragraphs[0].runs[0].font.size = Pt(28)
    tf.paragraphs[0].runs[0].font.bold = True
    tf.paragraphs[0].runs[0].font.color.rgb = RGBColor(*_COBALT)
    body_box = slide.shapes.add_textbox(Inches(0.5), Inches(1.3), Inches(9), Inches(5.5))
    body_tf = body_box.text_frame
    body_tf.word_wrap = True
    for i, line in enumerate(lines or ["—"]):
        p = body_tf.paragraphs[0] if i == 0 else body_tf.add_paragraph()
        p.text = f"• {line}"
        p.runs[0].font.size = Pt(14)
        p.runs[0].font.color.rgb = RGBColor(*_NEUTRAL_900)
    return slide


def _df_rows(dfs: Dict[str, Any], key: str) -> int:
    """Safe row count for a session dataframe — pandas DataFrame truth value
    is ambiguous, so we can't `df or []`."""
    df = dfs.get(key) if dfs else None
    try:
        return len(df) if df is not None else 0
    except Exception:
        return 0


def _fmt_kpi_actual(kr) -> str:
    actual = _g(kr, "actual")
    unit   = _g(kr, "unit", "")
    if actual is None: return "—"
    if unit == "%":     return f"{round(actual * 100)}%"
    if unit == "days":  return f"{round(actual)} days"
    if unit == "₹ Cr":  return f"₹{round(actual, 1)} Cr"
    return f"{round(actual, 2)}"


@router.get("/session/{session_id}/results/export/ppt")
def export_kpi_ppt(session_id: str):
    """KPI Dashboard Deck — ~13 slides, AIVault-branded."""
    sess = get_session(session_id)
    overall = sess.get("overall_result")
    kpi_assessment = sess.get("kpi_assessment")
    engagement = sess.get("engagement", {})
    if overall is None:
        raise HTTPException(status_code=400, detail="No assessment results — run pipeline first.")
    try:
        prs, Inches, Pt, RGBColor = _new_pptx()
        client = engagement.get("client_name", "Client")
        d      = engagement.get("date", "")

        _add_title_slide(prs, Inches, Pt, RGBColor,
                         f"{client} — Procurement maturity assessment",
                         f"AIVault · {d}")

        score = _g(overall, "score") or "—"
        level = _g(overall, "level") or ""
        scored_dims = _g(overall, "scored_dims", 0)
        total_dims  = _g(overall, "total_dims", 0)
        active_pct  = _g(overall, "active_weight_pct")
        _add_text_slide(prs, Inches, Pt, RGBColor, "Executive summary", [
            f"Overall maturity: {score} ({level})",
            f"Scored dimensions: {scored_dims} / {total_dims}",
            f"Active weight: {active_pct}%" if active_pct is not None else "Active weight: —",
        ])

        if kpi_assessment is not None:
            kpi_lines = []
            for kid, kr in (_g(kpi_assessment, "kpi_results") or {}).items():
                bench = _g(kr, "benchmark")
                bench_s = (
                    f"{round(bench * 100)}%" if _g(kr, "unit") == "%" and bench is not None else
                    f"{round(bench)} days" if _g(kr, "unit") == "days" and bench is not None else
                    f"₹{round(bench, 1)} Cr" if _g(kr, "unit") == "₹ Cr" and bench is not None else
                    str(bench)
                )
                kpi_lines.append(
                    f"{_g(kr, 'label', kid)}: {_fmt_kpi_actual(kr)} (benchmark {bench_s}) — {_g(kr, 'score_label', '')}"
                )
            _add_text_slide(prs, Inches, Pt, RGBColor, "KPI scorecard", kpi_lines[:14])

            for bucket, br in (_g(kpi_assessment, "bucket_results") or {}).items():
                kpi_titles = [_g(k, "label", "") for k in (_g(br, "kpis") or [])]
                _add_text_slide(prs, Inches, Pt, RGBColor,
                                f"{bucket} bucket — {_g(br, 'score_label', '')}",
                                [f"Bucket score: {_g(br, 'score', '—')}"] + kpi_titles)

        # Spend / RCA / actions / quick wins / offerings — driven by AI insights cache
        ai = sess.get("ai_insights") or {}
        gaps        = ai.get("gaps") or []
        priorities  = ai.get("priorities") or []
        risks       = ai.get("risk_flags") or []
        _add_text_slide(prs, Inches, Pt, RGBColor, "Gaps & root cause", gaps[:6] or ["See KPI scorecard for details."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Priority actions",  priorities[:5] or ["See AI Insights tab for the full list."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Risk flags",        risks[:5] or ["No high-severity signals detected."])

        # Appendix — data sources
        dfs = sess.get("dataframes") or {}
        _add_text_slide(prs, Inches, Pt, RGBColor, "Appendix · data sources", [
            f"PO rows: {_df_rows(dfs, 'po_df')}",
            f"PR rows: {_df_rows(dfs, 'pr_df')}",
            f"Invoice rows: {_df_rows(dfs, 'invoice_df')}",
            f"Workforce rows: {_df_rows(dfs, 'workforce_df')}",
            "QRE / questionnaire answers logged in session.",
        ])

        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{client}_KPI_Dashboard.pptx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/results/export/ppt/proposal")
def export_proposal_ppt(session_id: str):
    """Transformation Proposal Deck — ~18 slides, AIVault-branded."""
    sess = get_session(session_id)
    engagement = sess.get("engagement", {})
    try:
        prs, Inches, Pt, RGBColor = _new_pptx()
        client = engagement.get("client_name", "Client")
        _add_title_slide(prs, Inches, Pt, RGBColor,
                         f"{client} — Procurement transformation proposal",
                         "AIVault")
        _add_text_slide(prs, Inches, Pt, RGBColor, "Current state", ["Maturity baseline established from the assessment."])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Gap analysis", ["Bucket-level gap analysis from KPI scorecard."])
        for ws in WORKSTREAMS:
            _add_text_slide(prs, Inches, Pt, RGBColor, f"Workstream: {ws['title']}", [
                "Scope, deliverables, outcomes",
                "Owner, dependencies, success metrics",
                "Risks and mitigations",
            ])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Programme roadmap",
                        ["Phase 1 — 0–3 months", "Phase 2 — 3–6 months", "Phase 3 — 6–12 months"])
        _add_text_slide(prs, Inches, Pt, RGBColor, "Investment estimate",
                        ["Programme cost", "Expected savings", "ROI / payback"])
        out = io.BytesIO()
        prs.save(out)
        out.seek(0)
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{client}_Transformation_Proposal.pptx"'},
        )
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
