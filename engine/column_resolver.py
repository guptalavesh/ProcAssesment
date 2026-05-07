from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ── Resolution result ────────────────────────────────────────────────────────
@dataclass
class ColumnResolutionResult:
    """Output of resolve_for_skill / resolve_columns.

    - resolved: confident matches (logical_name → actual header).
    - suggestions: probable matches the user should confirm (logical_name →
      (suggested_actual, confidence)).
    - unmatched: logical names with no plausible header.

    Note: `suggestions` is a tuple-valued dict because the column_review
    router unpacks it as `(suggested, confidence)`.
    """
    resolved:    Dict[str, str] = field(default_factory=dict)
    suggestions: Dict[str, Tuple[str, float]] = field(default_factory=dict)
    unmatched:   List[str] = field(default_factory=list)
    available_columns: List[str] = field(default_factory=list)
    skill_aliases:     Dict[str, List[str]] = field(default_factory=dict)

    def needs_user_review(self) -> bool:
        return bool(self.suggestions) or bool(self.unmatched)


# ── Matching primitives ──────────────────────────────────────────────────────
_NORMALISE_RE = re.compile(r"[\s_\-\.]+")


def _normalise(name: str) -> str:
    """Lowercase and collapse separators so 'PO Number', 'po_number' and
    'PO-Number' compare equal."""
    return _NORMALISE_RE.sub("", str(name).strip().lower())


def _similarity(a: str, b: str) -> float:
    """0.0–1.0 ratio of lexical similarity between two normalised names."""
    return SequenceMatcher(None, _normalise(a), _normalise(b)).ratio()


def _best_match(
    logical: str,
    aliases: List[str],
    candidates: List[str],
) -> Tuple[Optional[str], float]:
    """Return the candidate column that best matches `logical` (and its
    aliases), with a confidence in [0, 1]."""
    if not candidates:
        return None, 0.0
    norm_candidates = {c: _normalise(c) for c in candidates}
    targets = [logical] + list(aliases or [])
    norm_targets = [_normalise(t) for t in targets]

    # 1) Exact normalised match
    for c, nc in norm_candidates.items():
        if nc in norm_targets:
            return c, 1.0

    # 2) Substring containment in either direction (high confidence)
    for nt in norm_targets:
        if not nt:
            continue
        for c, nc in norm_candidates.items():
            if nt in nc or nc in nt:
                return c, 0.85

    # 3) Fuzzy similarity, max over all alias variants
    best_col, best_score = None, 0.0
    for nt in norm_targets:
        if not nt:
            continue
        for c, nc in norm_candidates.items():
            score = _similarity(nt, nc)
            if score > best_score:
                best_col, best_score = c, score
    return best_col, best_score


# ── Public resolution API ────────────────────────────────────────────────────
def resolve_columns(
    logical_names: List[str],
    available_columns: List[str],
    aliases_by_logical: Optional[Dict[str, List[str]]] = None,
    threshold_resolved: float = 0.92,
    threshold_suggested: float = 0.62,
) -> ColumnResolutionResult:
    """Resolve a list of logical names against a single set of headers."""
    aliases_by_logical = aliases_by_logical or {}
    result = ColumnResolutionResult(
        available_columns=list(available_columns),
        skill_aliases={k: list(v) for k, v in aliases_by_logical.items()},
    )
    used: set[str] = set()
    for logical in logical_names:
        candidates = [c for c in available_columns if c not in used]
        col, score = _best_match(logical, aliases_by_logical.get(logical, []), candidates)
        if col is None:
            result.unmatched.append(logical)
            continue
        if score >= threshold_resolved:
            result.resolved[logical] = col
            used.add(col)
        elif score >= threshold_suggested:
            result.suggestions[logical] = (col, round(score, 3))
        else:
            result.unmatched.append(logical)
    return result


# Logical names that live on PR / Invoice / Workforce / etc., not PO.
_PR_NAMES        = {"pr_number", "pr_date", "pr_creation_date", "pr_release_date", "pr_creator", "pr_item"}
_INVOICE_NAMES   = {"invoice_number", "invoice_date", "invoice_amount", "payment_date", "due_date", "payment_terms"}
_WORKFORCE_NAMES = {"employee_id", "employee_name", "role", "department", "location"}


def _pick_source_columns(
    logical: str,
    sources: Dict[str, List[str]],
) -> List[str]:
    """Return the candidate column list for a logical name based on which
    source DF it semantically belongs to."""
    if logical in _PR_NAMES:
        return sources.get("pr") or []
    if logical in _INVOICE_NAMES:
        return sources.get("invoice") or []
    if logical in _WORKFORCE_NAMES:
        return sources.get("workforce") or []
    return sources.get("po") or []


def resolve_for_skill(
    skill_column_aliases: Dict[str, List[str]],
    po_columns: List[str],
    pr_columns: Optional[List[str]] = None,
    invoice_columns: Optional[List[str]] = None,
    workforce_columns: Optional[List[str]] = None,
    inventory_columns: Optional[List[str]] = None,
    goods_movement_columns: Optional[List[str]] = None,
    po_gr_columns: Optional[List[str]] = None,
    production_columns: Optional[List[str]] = None,
    maintenance_columns: Optional[List[str]] = None,
    threshold_resolved: float = 0.92,
    threshold_suggested: float = 0.62,
) -> ColumnResolutionResult:
    """Resolve every logical name in `skill_column_aliases` against the
    appropriate uploaded source. Logical names that live on PR/invoice/
    workforce dispatch to those headers; everything else uses the PO file."""
    sources = {
        "po":          po_columns or [],
        "pr":          pr_columns or [],
        "invoice":     invoice_columns or [],
        "workforce":   workforce_columns or [],
        "inventory":   inventory_columns or [],
        "gm":          goods_movement_columns or [],
        "po_gr":       po_gr_columns or [],
        "production":  production_columns or [],
        "maintenance": maintenance_columns or [],
    }
    all_columns = sorted({c for cols in sources.values() for c in cols})
    result = ColumnResolutionResult(
        available_columns=all_columns,
        skill_aliases={k: list(v) for k, v in skill_column_aliases.items()},
    )

    used_per_source: Dict[str, set[str]] = {k: set() for k in sources}
    for logical, aliases in skill_column_aliases.items():
        candidates_source = _pick_source_columns(logical, sources)
        # Exclude already-used columns within the same source
        source_key = next((k for k, v in sources.items() if v is candidates_source), "po")
        candidates = [c for c in candidates_source if c not in used_per_source.get(source_key, set())]

        col, score = _best_match(logical, aliases, candidates)
        if col is None:
            result.unmatched.append(logical)
            continue
        if score >= threshold_resolved:
            result.resolved[logical] = col
            used_per_source[source_key].add(col)
        elif score >= threshold_suggested:
            result.suggestions[logical] = (col, round(score, 3))
        else:
            result.unmatched.append(logical)
    return result


# ── User-decision application ────────────────────────────────────────────────
def apply_user_decisions(
    col_res: ColumnResolutionResult,
    confirmed: Optional[Dict[str, str]] = None,
    unavailable: Optional[List[str]] = None,
) -> None:
    """Mutate `col_res` to reflect the user's column-review decisions.

    - confirmed: {logical: actual} mapping the user confirmed (overrides
      both suggestions and previously-resolved entries).
    - unavailable: logical names the user marked as not present in their data.
    """
    confirmed = confirmed or {}
    unavailable = set(unavailable or [])

    for logical, actual in confirmed.items():
        if not actual:
            continue
        col_res.resolved[logical] = actual
        col_res.suggestions.pop(logical, None)
        if logical in col_res.unmatched:
            col_res.unmatched.remove(logical)

    for logical in unavailable:
        col_res.resolved.pop(logical, None)
        col_res.suggestions.pop(logical, None)
        if logical not in col_res.unmatched:
            col_res.unmatched.append(logical)


# ── Persistence (best-effort, never fatal) ───────────────────────────────────
_CACHE_DIR = Path(os.environ.get("PROC_COLMAP_CACHE", "/tmp/proc_colmaps"))


def _safe_slug(s: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]+", "_", str(s)).strip("_") or "client"


def save_column_map(client_name: str, function_name: str, final_map: Dict[str, str]) -> None:
    """Persist a {logical: actual} map keyed by client + function so future
    uploads from the same client can pre-fill. Failures are swallowed."""
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = _CACHE_DIR / f"{_safe_slug(client_name)}__{_safe_slug(function_name)}.json"
        path.write_text(json.dumps(final_map, indent=2, sort_keys=True))
    except Exception as e:
        print(f"[column_resolver] save_column_map skip: {e}")


def load_column_map(client_name: str, function_name: str) -> Dict[str, str]:
    """Load a previously-saved column map, returning {} on miss."""
    try:
        path = _CACHE_DIR / f"{_safe_slug(client_name)}__{_safe_slug(function_name)}.json"
        if path.exists():
            return json.loads(path.read_text()) or {}
    except Exception as e:
        print(f"[column_resolver] load_column_map skip: {e}")
    return {}
