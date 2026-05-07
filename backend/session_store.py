from __future__ import annotations

import time
import uuid
from typing import Any, Dict

# ── In-memory session store ───────────────────────────────────────────────────
# Sessions are plain Python dicts stored in a module-level dict.
# TTL = 4 hours. The startup event calls cleanup_expired() once.

_SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 4 * 3600  # 4 hours


def _empty_session() -> Dict[str, Any]:
    return {
        # ── Identity ──────────────────────────────────────────────────────────
        "created_at": time.time(),
        "session_id": None,
        # ── Setup ─────────────────────────────────────────────────────────────
        "engagement":   None,  # dict with client_name, industry, fte_count, etc.
        "skill_config": None,  # SkillConfig object from v1 engine
        # ── Data ──────────────────────────────────────────────────────────────
        "dataframes":   {
            "po_df": None, "pr_df": None, "qre_df": None,
            "invoice_df": None, "workforce_df": None,
            "inventory_df": None, "goods_movement_df": None,
            "po_gr_df": None, "production_df": None, "maintenance_df": None,
            "quality_df": None,
        },
        "pdf_bytes":    None,
        "pdf_filename": None,
        # ── Column resolution ─────────────────────────────────────────────────
        "col_resolution": None,   # ColumnResolutionResult object
        "final_col_map":  {},     # {logical_name: actual_column}
        "confirmed_cols": {},
        "unavailable_cols": [],
        # ── Configuration ─────────────────────────────────────────────────────
        "weight_config":     {},  # {dim_id: float 0-1}
        "include_dims":      {},  # {dim_id: bool}
        "kpi_weight_config": {},  # {kpi_id: float 0-1}
        "formula_overrides": {},  # {kpi_id: {benchmark: float, multipliers: {}}}
        "formula_params":    {},  # {kpi_id: {param_key: value}}
        # ── Run ───────────────────────────────────────────────────────────────
        "run_done":  False,
        "run_error": None,
        "run_queue": None,  # queue.Queue for SSE events
        # ── Results ───────────────────────────────────────────────────────────
        "kpi_results":    None,
        "dim_results":    None,
        "overall_result": None,
        "kpi_assessment": None,
        "data_bundle":    None,
        "insights":       None,
        "report_bytes":   None,
        # ── QRE / text ────────────────────────────────────────────────────────
        "text_qre_results":    None,
        "text_qre_confirmed":  {},
        "questionnaire_detail": {},
        "discovery_qre":       {},
        # ── AI caches ─────────────────────────────────────────────────────────
        "ai_insights":              None,
        "ai_tab_insights_kpi_overview": None,
        "ai_tab_insights_rca":      None,
        "ai_tab_insights_offerings": None,
        "ai_buying_categories":     None,
        # ── LLM config ────────────────────────────────────────────────────────
        "llm_api_key":  None,
        "llm_base_url": "https://api.openai.com/v1",
        "llm_model":    "gpt-4o-mini",
    }


def create_session() -> str:
    sid = str(uuid.uuid4())
    sess = _empty_session()
    sess["session_id"] = sid
    _SESSIONS[sid] = sess
    return sid


def get_session(session_id: str) -> Dict[str, Any]:
    sess = _SESSIONS.get(session_id)
    if sess is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Session {session_id!r} not found or expired.")
    # Renew TTL on access
    sess["created_at"] = time.time()
    return sess


def delete_session(session_id: str) -> None:
    _SESSIONS.pop(session_id, None)


def cleanup_expired() -> int:
    now = time.time()
    expired = [sid for sid, sess in _SESSIONS.items()
               if now - sess.get("created_at", 0) > SESSION_TTL_SECONDS]
    for sid in expired:
        del _SESSIONS[sid]
    return len(expired)
