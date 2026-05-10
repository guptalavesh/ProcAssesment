from __future__ import annotations
import io
from typing import Optional
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["upload"])


def _maybe_pick_sheet(data_bytes, filename, sheet):
    """If xlsx and a sheet is specified, extract that sheet into fresh xlsx bytes."""
    if not data_bytes or not sheet or not filename:
        return data_bytes
    if not filename.lower().endswith((".xlsx", ".xls")):
        return data_bytes
    try:
        bio = io.BytesIO(data_bytes)
        xl = pd.ExcelFile(bio)
        if sheet not in xl.sheet_names:
            return data_bytes
        df = xl.parse(sheet)
        out = io.BytesIO()
        df.to_excel(out, index=False, sheet_name=sheet[:31] or "Sheet1")
        return out.getvalue()
    except Exception:
        return data_bytes


@router.post("/session/{session_id}/upload")
async def upload_files(
    session_id: str,
    po_file:             Optional[UploadFile] = File(None),
    pr_file:             Optional[UploadFile] = File(None),
    qre_file:            Optional[UploadFile] = File(None),
    invoice_file:        Optional[UploadFile] = File(None),
    workforce_file:      Optional[UploadFile] = File(None),
    quality_file:        Optional[UploadFile] = File(None),
    inventory_file:      Optional[UploadFile] = File(None),
    goods_movement_file: Optional[UploadFile] = File(None),
    po_gr_file:          Optional[UploadFile] = File(None),
    production_file:     Optional[UploadFile] = File(None),
    maintenance_file:    Optional[UploadFile] = File(None),
    pdf_file:            Optional[UploadFile] = File(None),
    po_sheet:             Optional[str] = Form(None),
    pr_sheet:             Optional[str] = Form(None),
    qre_sheet:            Optional[str] = Form(None),
    invoice_sheet:        Optional[str] = Form(None),
    workforce_sheet:      Optional[str] = Form(None),
    quality_sheet:        Optional[str] = Form(None),
    inventory_sheet:      Optional[str] = Form(None),
    goods_movement_sheet: Optional[str] = Form(None),
    po_gr_sheet:          Optional[str] = Form(None),
    production_sheet:     Optional[str] = Form(None),
    maintenance_sheet:    Optional[str] = Form(None),
):
    from engine.data_loader import (
        DataLoadError,
        load_po_dump, load_pr_dump, load_qre, load_invoice,
        load_workforce, load_inventory, load_goods_movement,
        load_po_gr, load_production, load_maintenance,
    )
    from engine.column_resolver import resolve_for_skill
    from engine.metrics import get_coverage_preview

    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")

    async def _read(upload):
        if upload is None: return None
        data = await upload.read()
        return data if data else None

    po_bytes         = _maybe_pick_sheet(await _read(po_file),     po_file.filename if po_file else None, po_sheet)
    pr_bytes         = _maybe_pick_sheet(await _read(pr_file),     pr_file.filename if pr_file else None, pr_sheet)
    qre_bytes        = _maybe_pick_sheet(await _read(qre_file),    qre_file.filename if qre_file else None, qre_sheet)
    invoice_bytes    = _maybe_pick_sheet(await _read(invoice_file), invoice_file.filename if invoice_file else None, invoice_sheet)
    workforce_bytes  = _maybe_pick_sheet(await _read(workforce_file), workforce_file.filename if workforce_file else None, workforce_sheet)
    quality_bytes    = await _read(quality_file)
    inventory_bytes  = _maybe_pick_sheet(await _read(inventory_file), inventory_file.filename if inventory_file else None, inventory_sheet)
    gm_bytes         = _maybe_pick_sheet(await _read(goods_movement_file), goods_movement_file.filename if goods_movement_file else None, goods_movement_sheet)
    po_gr_bytes      = _maybe_pick_sheet(await _read(po_gr_file),  po_gr_file.filename if po_gr_file else None, po_gr_sheet)
    production_bytes = _maybe_pick_sheet(await _read(production_file), production_file.filename if production_file else None, production_sheet)
    maintenance_bytes = _maybe_pick_sheet(await _read(maintenance_file), maintenance_file.filename if maintenance_file else None, maintenance_sheet)
    pdf_bytes        = await _read(pdf_file)

    file_results = {}
    dfs = sess["dataframes"]

    def _load(name, loader, data_bytes):
        if not data_bytes: return None
        bio = io.BytesIO(data_bytes)
        try:
            df = loader(bio)
            dfs[name] = df
            return {"rows": len(df), "columns": len(df.columns), "ok": True}
        except DataLoadError as e:
            return {"rows": 0, "columns": 0, "ok": False, "error": str(e)}
        except Exception as e:
            return {"rows": 0, "columns": 0, "ok": False, "error": str(e)}

    file_results["po"]             = _load("po_df",             load_po_dump,        po_bytes)
    file_results["pr"]             = _load("pr_df",             load_pr_dump,        pr_bytes)
    file_results["qre"]            = _load("qre_df",            load_qre,            qre_bytes)
    file_results["invoice"]        = _load("invoice_df",        load_invoice,        invoice_bytes)
    file_results["workforce"]      = _load("workforce_df",      load_workforce,      workforce_bytes)
    file_results["inventory"]      = _load("inventory_df",      load_inventory,      inventory_bytes)
    file_results["goods_movement"] = _load("goods_movement_df", load_goods_movement, gm_bytes)
    file_results["po_gr"]          = _load("po_gr_df",          load_po_gr,          po_gr_bytes)
    file_results["production"]     = _load("production_df",     load_production,     production_bytes)
    file_results["maintenance"]    = _load("maintenance_df",    load_maintenance,    maintenance_bytes)

    if quality_bytes:
        try:
            bio = io.BytesIO(quality_bytes)
            fname = quality_file.filename or ""
            df = pd.read_excel(bio) if fname.endswith((".xlsx",".xls")) else pd.read_csv(bio)
            dfs["quality_df"] = df
            file_results["quality"] = {"rows": len(df), "columns": len(df.columns), "ok": True}
        except Exception as e:
            file_results["quality"] = {"rows": 0, "columns": 0, "ok": False, "error": str(e)}

    if pdf_bytes:
        sess["pdf_bytes"] = pdf_bytes
        sess["pdf_filename"] = pdf_file.filename if pdf_file else ""

    # Column resolution
    needs_review = False
    col_resolution = None
    try:
        def _df_cols(key):
            df = dfs.get(key)
            return list(df.columns) if df is not None else None

        col_resolution = resolve_for_skill(
            skill_column_aliases=skill.column_aliases,
            po_columns=_df_cols("po_df") or [],
            pr_columns=_df_cols("pr_df"),
            invoice_columns=_df_cols("invoice_df"),
            workforce_columns=_df_cols("workforce_df"),
            inventory_columns=_df_cols("inventory_df"),
            goods_movement_columns=_df_cols("goods_movement_df"),
            po_gr_columns=_df_cols("po_gr_df"),
            production_columns=_df_cols("production_df"),
            maintenance_columns=_df_cols("maintenance_df"),
        )

        # Source-separation fix: PR-owned logical names must resolve to PR df columns
        if dfs.get("pr_df") is not None and col_resolution is not None:
            from engine.column_resolver import resolve_columns as _rc_single
            po_col_set = set(_df_cols("po_df") or [])
            pr_col_set = set(_df_cols("pr_df") or [])
            PR_OWNED = {"pr_date","pr_number","pr_release_date","pr_creator","pr_creation_date"}
            for logical in PR_OWNED:
                bad_col = col_resolution.resolved.get(logical)
                if bad_col and bad_col in po_col_set and bad_col not in pr_col_set:
                    pr_only = _rc_single([logical], list(pr_col_set))
                    if pr_only.resolved.get(logical):
                        col_resolution.resolved[logical] = pr_only.resolved[logical]
                    elif pr_only.suggestions.get(logical):
                        col_resolution.resolved.pop(logical, None)
                        col_resolution.suggestions[logical] = pr_only.suggestions[logical]
                    else:
                        col_resolution.resolved.pop(logical, None)
                        if logical not in col_resolution.unmatched:
                            col_resolution.unmatched.append(logical)

        sess["col_resolution"] = col_resolution
        sess["final_col_map"] = dict(col_resolution.resolved)
        needs_review = col_resolution.needs_user_review()
    except Exception as e:
        import traceback; traceback.print_exc()

    # Coverage preview
    coverage = {}
    try:
        col_map_for_coverage = col_resolution.resolved if col_resolution else {}
        available_sources = [k for k, v in dfs.items() if v is not None]
        coverage = get_coverage_preview(skill, col_map_for_coverage, available_sources)
    except Exception as e:
        print(f"[coverage_preview] WARNING: {e}")

    next_screen = "column_review" if needs_review else "configure"
    return {
        "files": file_results,
        "coverage": coverage,
        "next_screen": next_screen,
        "needs_column_review": needs_review,
    }


class TextQREPayload(BaseModel):
    text: str


@router.post("/session/{session_id}/parse-text-qre")
def parse_text_qre(session_id: str, payload: TextQREPayload):
    from engine.text_qre_parser import parse_free_text_qre
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    try:
        results = parse_free_text_qre(payload.text, skill)
        sess["text_qre_results"] = results
        return {"results": [
            {"dim_id": r.dim_id, "dim_name": r.dim_name, "score": r.score,
             "confidence": r.confidence, "confidence_label": r.confidence_label,
             "evidence": r.evidence}
            for r in results.values()
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TextQREConfirmPayload(BaseModel):
    confirmed: dict  # {dim_id: score_int}


@router.post("/session/{session_id}/confirm-text-qre")
def confirm_text_qre(session_id: str, payload: TextQREConfirmPayload):
    sess = get_session(session_id)
    sess["text_qre_confirmed"] = {k: int(v) for k, v in payload.confirmed.items()}
    # Re-aggregate scores immediately so UI shows updated score without re-run
    dim_results = sess.get("dim_results") or []
    overall_result = sess.get("overall_result")
    kpi_assessment = sess.get("kpi_assessment")
    confirmed = sess["text_qre_confirmed"]
    if dim_results and overall_result and confirmed:
        def _g(o, k, default=None):
            return getattr(o, k, default) if hasattr(o, k) else (o.get(k, default) if isinstance(o, dict) else default)
        for dr in dim_results:
            dim_id = _g(dr, "dim_id")
            if dim_id and dim_id in confirmed:
                new_score = int(confirmed[dim_id])
                if hasattr(dr, "score"): dr.score = new_score; dr.data_source = "qre"
                elif isinstance(dr, dict): dr["score"] = new_score; dr["data_source"] = "qre"
        scored = [dr for dr in dim_results if _g(dr, "score") is not None]
        if scored:
            total_w = sum(float(_g(dr, "weight") or 0) for dr in scored)
            weighted = sum(float(_g(dr, "score") or 0) * float(_g(dr, "weight") or 0) for dr in scored)
            if total_w > 0:
                new_dim_overall = weighted / total_w
                if hasattr(overall_result, "score"): overall_result.score = round(new_dim_overall, 2)
        if kpi_assessment is not None and confirmed:
            kpi_score = getattr(kpi_assessment, "overall_score", None)
            if kpi_score is not None:
                qre_total_w, qre_weighted = 0.0, 0.0
                for dr in dim_results:
                    dim_id = _g(dr, "dim_id")
                    if dim_id and dim_id in confirmed:
                        w = float(_g(dr, "weight") or 0)
                        qre_total_w += w; qre_weighted += float(confirmed[dim_id]) * w
                if qre_total_w > 0:
                    blended = (kpi_score * 1.0 + qre_weighted) / (1.0 + qre_total_w)
                    kpi_assessment.overall_score = round(blended, 2)
    return {"ok": True, "confirmed_count": len(payload.confirmed)}
