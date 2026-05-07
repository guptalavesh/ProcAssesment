from fastapi import APIRouter
from session_store import create_session, delete_session, get_session

router = APIRouter(tags=["session"])


@router.post("/session")
def new_session():
    sid = create_session()
    return {"session_id": sid}


@router.delete("/session/{session_id}")
def end_session(session_id: str):
    delete_session(session_id)
    return {"ok": True}


@router.get("/session/{session_id}/state")
def session_state(session_id: str):
    sess = get_session(session_id)
    return {
        "has_engagement":  sess.get("engagement") is not None,
        "has_skill":       sess.get("skill_config") is not None,
        "has_data":        any(v is not None for v in sess["dataframes"].values()),
        "has_results":     sess.get("overall_result") is not None,
        "run_done":        sess.get("run_done", False),
        "run_error":       sess.get("run_error"),
        "needs_col_review":sess.get("col_resolution") is not None and
                           (sess["col_resolution"].needs_user_review()
                            if hasattr(sess.get("col_resolution", object()), "needs_user_review")
                            else False),
    }
