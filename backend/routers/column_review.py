from __future__ import annotations
from typing import Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["column_review"])


@router.get("/session/{session_id}/columns")
def get_columns(session_id: str):
    sess = get_session(session_id)
    col_res = sess.get("col_resolution")
    if col_res is None:
        return {"resolved": {}, "suggestions": {}, "unmatched": [], "available_columns": [], "skill_aliases": {}}
    skill = sess["skill_config"]
    skill_aliases = skill.column_aliases if skill else {}
    available_cols = set()
    for df in sess["dataframes"].values():
        if df is not None: available_cols.update(df.columns.tolist())
    suggestions = {}
    for logical, (suggested, confidence) in (col_res.suggestions or {}).items():
        suggestions[logical] = {"suggested": suggested, "confidence": round(confidence, 3)}
    return {
        "resolved": col_res.resolved or {},
        "suggestions": suggestions,
        "unmatched": list(col_res.unmatched or []),
        "available_columns": sorted(available_cols),
        "skill_aliases": skill_aliases,
    }


class ColumnConfirmPayload(BaseModel):
    confirmed: Dict[str, str] = {}
    unavailable: List[str] = []


@router.post("/session/{session_id}/columns/confirm")
def confirm_columns(session_id: str, payload: ColumnConfirmPayload):
    from engine.column_resolver import apply_user_decisions, save_column_map
    sess = get_session(session_id)
    col_res = sess.get("col_resolution")
    if col_res is None:
        raise HTTPException(status_code=400, detail="No column resolution to confirm.")
    final_map = dict(col_res.resolved or {})
    final_map.update(payload.confirmed)
    for logical in payload.unavailable:
        final_map.pop(logical, None)
    sess["confirmed_cols"] = dict(payload.confirmed)
    sess["unavailable_cols"] = list(payload.unavailable)
    sess["final_col_map"] = final_map
    client_name = sess.get("engagement", {}).get("client_name", "")
    skill = sess.get("skill_config")
    if client_name and skill:
        try: save_column_map(client_name, skill.function_name, final_map)
        except Exception: pass
    return {"ok": True, "final_map": final_map}
