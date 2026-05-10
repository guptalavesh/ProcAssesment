from __future__ import annotations

from typing import Any, Dict, Optional


# Optional PDF analysis. The hosted deploy uses Vertex AI Gemini for AI
# insights; this module exists only because run.py imports it on the
# happy path when a PDF is uploaded. We keep it dependency-free and
# return a minimal shape so the pipeline doesn't fail.

def analyse_pdf(
    pdf_bytes: bytes,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Return a placeholder qualitative-analysis result.

    We don't ship a real LLM-driven PDF analyser here — the production path
    is Vertex AI Gemini via routers/ai_insights.py. This stub returns a
    well-formed empty payload so run.py's optional Step 3 stays a no-op
    when a PDF is present but no LLM is wired up.
    """
    page_estimate = max(1, len(pdf_bytes or b"") // 50_000)  # ~50KB per page
    return {
        "summary": "",
        "highlights": [],
        "risks": [],
        "page_estimate": page_estimate,
        "engine": "stub",
    }
