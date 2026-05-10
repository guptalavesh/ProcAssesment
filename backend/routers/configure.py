from __future__ import annotations
from typing import Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["configure"])


@router.get("/session/{session_id}/configure")
def get_configure(session_id: str):
    from engine.kpi_engine import KPI_META, BUCKETS, BUCKET_ICONS
    from engine.benchmark_loader import load_benchmarks, get_benchmark_display
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    is_procurement = "procurement" in skill.function_name.lower()
    engagement = sess.get("engagement", {})
    industry = engagement.get("industry", "")
    dimensions = []
    for dim_id, dim_cfg in skill.dimensions.items():
        dimensions.append({
            "dim_id": dim_id, "name": dim_cfg.name,
            "weight": round(dim_cfg.weight * 100, 1),
            "kpi_count": len(dim_cfg.kpis),
            "default_weight": round(dim_cfg.weight * 100, 1),
        })
    result = {
        "is_procurement": is_procurement,
        "dimensions": dimensions,
        "engagement": {"fte_count": engagement.get("fte_count"),
                       "annual_spend": engagement.get("annual_spend"),
                       "industry": industry},
    }
    if is_procurement:
        benchmarks = {}
        benchmarks_display = {}
        try:
            benchmarks = load_benchmarks(industry)
            benchmarks_display = get_benchmark_display(benchmarks)
        except Exception: pass
        data_ready = {}
        dfs = sess.get("dataframes", {})
        for kid, meta in KPI_META.items():
            sources = meta.get("sources", [])
            data_ready[kid] = any(dfs.get(s) is not None for s in sources)
        saved_kpi_weights = sess.get("kpi_weight_config", {})
        result["kpi_meta"] = {
            kid: {"label": m["label"], "weight": saved_kpi_weights.get(kid, m["weight"]),
                  "direction": m["direction"], "unit": m.get("unit",""), "bucket": m["bucket"]}
            for kid, m in KPI_META.items()
        }
        result["buckets"] = BUCKETS
        result["bucket_icons"] = BUCKET_ICONS
        result["data_ready"] = data_ready
        result["benchmarks_display"] = benchmarks_display
    return result


class ConfigurePayload(BaseModel):
    weight_config: Dict[str, float] = {}
    include_dims: Dict[str, bool] = {}
    kpi_weight_config: Dict[str, float] = {}


@router.post("/session/{session_id}/configure")
def save_configure(session_id: str, payload: ConfigurePayload):
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    weight_config = {dim_id: float(pct)/100.0 for dim_id, pct in payload.weight_config.items()}
    include_dims = {dim_id: payload.include_dims.get(dim_id, True) for dim_id in skill.dimensions}
    sess["weight_config"] = weight_config
    sess["include_dims"] = include_dims
    if payload.kpi_weight_config:
        sess["kpi_weight_config"] = {kpi_id: float(pct)/100.0 for kpi_id, pct in payload.kpi_weight_config.items()}
    return {"ok": True}
