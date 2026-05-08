from __future__ import annotations
import asyncio
import json
import queue
import threading
import time
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from session_store import get_session

router = APIRouter(tags=["run"])


def _emit(sess, event: dict):
    """Push an event onto the session's SSE queue (if exists)."""
    q = sess.get("run_queue")
    if q is not None:
        try:
            q.put_nowait(event)
        except Exception:
            pass


def _prepare_kpi_df(po_df: pd.DataFrame, col_map: Dict[str, str]) -> pd.DataFrame:
    """Add kpi_engine-compatible aliases from col_map. Forces PO date,
    masks PR date columns, builds combined 'agreement' column, derives 'last po price'.
    """
    if po_df is None or po_df.empty:
        return po_df
    df = po_df.copy()

    # Force PO date column to canonical name
    for cand in ["PO_Creation_Date", "PO_Date", "PO_Doc_Date"]:
        if cand in df.columns and "po_date" not in df.columns:
            df["po_date"] = df[cand]
            break

    # Mask PR date columns in PO df to force TAT join path
    for pr_col in ["PR_Creation_Date", "pr_date", "pr_creation_date"]:
        if pr_col in df.columns:
            df[pr_col + "_masked"] = df[pr_col]
            try:
                df.drop(columns=[pr_col], inplace=True)
            except Exception:
                pass

    # Build combined agreement column. astype(str) on NaN cells produces the
    # literal string "nan" — strip + replace so empty/NaN/"nan" all collapse
    # to "" before we pick the non-empty value.
    contract_col = col_map.get("contract_number")
    outline_col = col_map.get("outline_agreement")
    def _norm(series_or_const):
        if isinstance(series_or_const, pd.Series):
            # NB: pandas astype(str) does NOT always convert NaN floats to "nan"
            # strings — fillna first, then convert + strip + scrub literals.
            return (series_or_const.fillna("").astype(str).str.strip()
                    .replace({"nan": "", "None": "", "NaN": ""}))
        return pd.Series([""] * len(df), index=df.index)
    c1 = _norm(df[contract_col]) if contract_col and contract_col in df.columns else _norm(None)
    c2 = _norm(df[outline_col])  if outline_col  and outline_col  in df.columns else _norm(None)
    df["agreement"] = c1.where(c1 != "", c2)

    # last po price: shift(1) grouped by material + sorted by po_date
    mat_col = col_map.get("material_number")
    price_col = col_map.get("net_price")
    if mat_col and price_col and mat_col in df.columns and price_col in df.columns and "po_date" in df.columns:
        try:
            df_sorted = df.sort_values("po_date").copy()
            df_sorted["last po price"] = df_sorted.groupby(mat_col)[price_col].shift(1)
            df["last po price"] = df_sorted["last po price"].reindex(df.index)
        except Exception:
            pass

    return df


def _run_pipeline(session_id: str):
    """Background thread function for assessment pipeline."""
    sess = get_session(session_id)
    try:
        _emit(sess, {"step": 1, "total": 7, "pct": 5, "message": "Assembling data bundle...", "status": "running"})

        # Step 1: Assemble data bundle
        from engine.data_loader import assemble_bundle
        dfs = sess.get("dataframes", {})
        col_map = sess.get("final_col_map") or {}
        skill = sess.get("skill_config")
        engagement = sess.get("engagement", {})

        po_df = dfs.get("po_df")
        if po_df is not None:
            po_df = _prepare_kpi_df(po_df, col_map)
            dfs["po_df"] = po_df

        bundle = assemble_bundle(
            po_df=po_df,
            pr_df=dfs.get("pr_df"),
            qre_df=dfs.get("qre_df"),
            invoice_df=dfs.get("invoice_df"),
            workforce_df=dfs.get("workforce_df"),
            inventory_df=dfs.get("inventory_df"),
            goods_movement_df=dfs.get("goods_movement_df"),
            po_gr_df=dfs.get("po_gr_df"),
            production_df=dfs.get("production_df"),
            maintenance_df=dfs.get("maintenance_df"),
            quality_df=dfs.get("quality_df"),
            col_map=col_map,
        )
        sess["data_bundle"] = bundle

        # Step 2: Compute KPIs
        _emit(sess, {"step": 2, "total": 7, "pct": 20, "message": "Computing KPI metrics...", "status": "running"})
        from engine.kpi_engine import compute_all_kpis
        kpi_results = compute_all_kpis(bundle, skill, engagement)
        sess["kpi_results"] = kpi_results

        # Step 3: Optional PDF/qualitative analysis
        _emit(sess, {"step": 3, "total": 7, "pct": 35, "message": "Analysing qualitative inputs...", "status": "running"})
        pdf_bytes = sess.get("pdf_bytes")
        api_key = sess.get("llm_api_key")
        if pdf_bytes and api_key:
            try:
                from engine.qualitative_analyser import analyse_pdf
                qual = analyse_pdf(pdf_bytes, api_key=api_key, base_url=sess.get("llm_base_url"),
                                   model=sess.get("llm_model"))
                sess["qualitative"] = qual
            except Exception as e:
                print(f"[pipeline] qualitative skip: {e}")

        # Step 4: Score dimensions
        _emit(sess, {"step": 4, "total": 7, "pct": 50, "message": "Scoring dimensions...", "status": "running"})
        from engine.scorer import score_all_dimensions
        weight_config = sess.get("weight_config") or {}
        include_dims = sess.get("include_dims") or {}
        text_qre_confirmed = sess.get("text_qre_confirmed") or {}
        questionnaire_detail = sess.get("questionnaire_detail") or {}

        dim_results, overall_result = score_all_dimensions(
            skill=skill, kpi_results=kpi_results, bundle=bundle,
            weight_config=weight_config, include_dims=include_dims,
            text_qre_confirmed=text_qre_confirmed,
            questionnaire_detail=questionnaire_detail,
            engagement=engagement,
        )

        # Dimension 1.0 guard: if all KPIs score exactly 1.0, mark insufficient
        for dr in dim_results:
            kpi_scores = getattr(dr, "kpi_scores", {}) or {}
            all_one = kpi_scores and all(
                getattr(ks, "score", None) == 1.0 for ks in kpi_scores.values()
            )
            if all_one and getattr(dr, "data_source", None) != "qre":
                dr.status = "insufficient"
                dr.score = None
                dr.fallback_score = None

        sess["dim_results"] = dim_results
        sess["overall_result"] = overall_result

        # Step 5: KPI assessment + dashboard override
        _emit(sess, {"step": 5, "total": 7, "pct": 65, "message": "Computing KPI assessment...", "status": "running"})
        is_proc = "procurement" in skill.function_name.lower() if skill else False
        if is_proc:
            try:
                from engine.kpi_assessment import compute_kpi_assessment
                kpi_weight_config = sess.get("kpi_weight_config") or {}
                kpi_assessment = compute_kpi_assessment(
                    bundle=bundle, engagement=engagement,
                    weight_overrides=kpi_weight_config,
                    formula_overrides=sess.get("formula_overrides") or {},
                    formula_params=sess.get("formula_params") or {},
                )
                # Dashboard override: replace kpi_engine actuals with kpi_dashboard values.
                # Dashboard reports percentages as 0–100 (e.g. 56.2 = 56.2%). The
                # serializer renders unit "%" by multiplying by 100, so for those
                # KPIs we have to divide back to a fraction first.
                try:
                    from routers.kpi_dashboard import _compute_kpi_dashboard
                    dash = _compute_kpi_dashboard(session_id)
                    dash_kpis = dash.get("kpis", {}) or {}
                    for kid, kr in (kpi_assessment.kpi_results or {}).items():
                        if kid in dash_kpis and dash_kpis[kid].get("available"):
                            value = dash_kpis[kid].get("value")
                            unit = getattr(kr, "unit", "")
                            if unit == "%" and value is not None:
                                value = value / 100.0
                            kr.actual = value
                except Exception as e:
                    print(f"[pipeline] dashboard override skip: {e}")
                sess["kpi_assessment"] = kpi_assessment
            except Exception as e:
                print(f"[pipeline] kpi_assessment skip: {e}")

        # Step 6: Build report
        _emit(sess, {"step": 6, "total": 7, "pct": 85, "message": "Building report...", "status": "running"})
        try:
            from engine.report_builder import build_report
            report_bytes = build_report(
                engagement=engagement, skill=skill,
                dim_results=dim_results, overall=overall_result,
                kpi_assessment=sess.get("kpi_assessment"),
            )
            sess["report_bytes"] = report_bytes
        except Exception as e:
            print(f"[pipeline] report skip: {e}")

        # Step 7: Done
        _emit(sess, {"step": 7, "total": 7, "pct": 100, "message": "Done!", "status": "done"})
        sess["run_done"] = True
        sess["run_error"] = None
    except Exception as e:
        import traceback
        traceback.print_exc()
        sess["run_error"] = str(e)
        sess["run_done"] = True
        _emit(sess, {"step": 0, "total": 7, "pct": 0, "message": f"Error: {e}", "status": "error"})


@router.post("/session/{session_id}/run")
def trigger_run(session_id: str):
    sess = get_session(session_id)
    if sess.get("skill_config") is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    sess["run_done"] = False
    sess["run_error"] = None
    sess["run_queue"] = queue.Queue()
    t = threading.Thread(target=_run_pipeline, args=(session_id,), daemon=True)
    t.start()
    return {"ok": True}


@router.get("/session/{session_id}/run-status")
async def run_status(session_id: str):
    """SSE stream of run progress events."""
    sess = get_session(session_id)
    q = sess.get("run_queue")

    async def _gen():
        # Replay current state first
        if sess.get("run_done"):
            status = "error" if sess.get("run_error") else "done"
            yield f"data: {json.dumps({'status': status, 'pct': 100, 'message': sess.get('run_error') or 'Done'})}\n\n"
            return
        if q is None:
            yield f"data: {json.dumps({'status': 'error', 'pct': 0, 'message': 'No run in progress'})}\n\n"
            return
        # Drain queue
        while True:
            try:
                event = q.get(timeout=0.1)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("status") in ("done", "error"):
                    return
            except queue.Empty:
                if sess.get("run_done"):
                    status = "error" if sess.get("run_error") else "done"
                    yield f"data: {json.dumps({'status': status, 'pct': 100, 'message': sess.get('run_error') or 'Done'})}\n\n"
                    return
                await asyncio.sleep(0.5)

    return StreamingResponse(_gen(), media_type="text/event-stream")


@router.get("/session/{session_id}/run-status-json")
def run_status_json(session_id: str):
    """Lightweight polling status endpoint."""
    sess = get_session(session_id)
    if sess.get("run_error"):
        return {"status": "error", "pct": 0, "message": sess["run_error"]}
    if sess.get("run_done"):
        return {"status": "done", "pct": 100, "message": "Done"}
    q = sess.get("run_queue")
    last = {"status": "running", "pct": 0, "message": "Starting..."}
    if q is not None:
        # Peek without consuming events meant for SSE
        try:
            tmp = []
            while True:
                try:
                    ev = q.get_nowait()
                    tmp.append(ev)
                except queue.Empty:
                    break
            for ev in tmp:
                last = ev
            # Re-queue events
            for ev in tmp:
                q.put_nowait(ev)
        except Exception:
            pass
    return last
