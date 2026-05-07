from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Tuple


@dataclass
class TextQREResult:
    dim_id: str
    dim_name: str
    score: int                # 1..4
    confidence: float         # 0.0..1.0
    confidence_label: str     # "high" | "medium" | "low"
    evidence: List[str]


# Maturity-level keyword lexicons. The parser tries to attribute sentences to
# dimensions by name, then scores each attributed sentence by which lexicon it
# matches most.
_LEVEL_KEYWORDS: Dict[int, List[str]] = {
    1: ["no ", "not in place", "ad hoc", "ad-hoc", "manual", "informal",
        "missing", "lack of", "absent", "none ", "haven't", "haven’t"],
    2: ["partial", "partially", "some ", "starting", "beginning", "in progress",
        "limited", "early stage", "patchy", "inconsistent"],
    3: ["mostly", "in place", "established", "documented", "tracked",
        "structured", "reviewed", "consistent", "defined"],
    4: ["leading", "best in class", "fully deployed", "industry leading",
        "automated", "predictive", "world class", "embedded", "always"],
}


def _split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", str(text or ""))
    return [p.strip() for p in parts if p and p.strip()]


def _dimension_lexicon(dim) -> List[str]:
    """Words the parser uses to attribute a sentence to this dimension —
    the dimension name itself plus its key salient terms."""
    name = (dim.name or "").lower()
    tokens: List[str] = []
    # Whole name + each significant word
    if name:
        tokens.append(name)
        for tok in re.split(r"[\s/&\-]+", name):
            t = tok.strip().lower()
            if len(t) > 3 and t not in {"and", "the", "with"}:
                tokens.append(t)
    # A small hand-rolled set of synonyms for common procurement dimensions
    HINTS: Dict[str, List[str]] = {
        "Strategy & Governance":        ["strategy", "governance", "mandate", "policy"],
        "Spend Visibility & Analytics": ["spend", "analytics", "visibility", "dashboard"],
        "Category Management":          ["category", "categories"],
        "Sourcing & Contracting":       ["sourcing", "contract", "rfp", "rfq", "tender"],
        "Supplier Management":          ["supplier", "vendor", "scorecard"],
        "Operational Procurement":      ["catalogue", "catalog", "requisition", "po", "purchase order"],
        "Purchase-to-Pay Process":      ["p2p", "purchase to pay", "invoice", "three-way", "3-way"],
        "Risk & Compliance":            ["risk", "compliance", "audit", "sanction"],
        "Digital & Technology":         ["digital", "s2p", "platform", "technology", "automation"],
        "People & Organisation":        ["talent", "people", "training", "capability", "team"],
        "Sustainability":               ["sustain", "esg", "scope 3", "emission", "carbon"],
        "Value Delivery":               ["savings", "value", "benefit"],
        "Innovation":                   ["innovation", "startup", "venture", "ideation"],
    }
    tokens.extend(HINTS.get(dim.name, []))
    return list(dict.fromkeys(t.lower() for t in tokens if t))  # de-dupe


def _score_sentence(sentence: str) -> Tuple[int | None, int]:
    """Return (best_level, hits) for a sentence based on level lexicons.
    `hits` is the total number of keyword matches across all levels."""
    s = sentence.lower()
    counts = {lvl: 0 for lvl in _LEVEL_KEYWORDS}
    for lvl, keywords in _LEVEL_KEYWORDS.items():
        for kw in keywords:
            if kw in s:
                counts[lvl] += 1
    total = sum(counts.values())
    if total == 0:
        return None, 0
    # Pick the level with the most hits; ties resolved by higher level
    best_level = max(counts, key=lambda lv: (counts[lv], lv))
    return best_level, total


def _confidence_label(c: float) -> str:
    if c >= 0.7:  return "high"
    if c >= 0.4:  return "medium"
    return "low"


def parse_free_text_qre(text: str, skill) -> Dict[str, TextQREResult]:
    """Extract per-dimension maturity scores from a free-text narrative.

    The parser splits text into sentences, attributes each sentence to a
    dimension by keyword, then scores attributed sentences via a maturity-
    level lexicon. Returns a dict keyed by dim_id; only dimensions with at
    least one matching sentence are present.
    """
    sentences = _split_sentences(text)
    if not sentences:
        return {}

    # Pre-compute per-dimension lexicons
    lexicons: Dict[str, Tuple[object, List[str]]] = {
        dim_id: (dim, _dimension_lexicon(dim))
        for dim_id, dim in skill.dimensions.items()
    }

    # Bucket sentences per dimension
    by_dim: Dict[str, List[str]] = {dim_id: [] for dim_id in skill.dimensions}
    for sent in sentences:
        s_low = sent.lower()
        for dim_id, (_, tokens) in lexicons.items():
            if any(tok in s_low for tok in tokens):
                by_dim[dim_id].append(sent)

    results: Dict[str, TextQREResult] = {}
    for dim_id, dim_sents in by_dim.items():
        if not dim_sents:
            continue
        scores: List[int] = []
        evidence: List[str] = []
        total_hits = 0
        for sent in dim_sents:
            lvl, hits = _score_sentence(sent)
            if lvl is None:
                continue
            scores.append(lvl)
            total_hits += hits
            if len(evidence) < 3:
                evidence.append(sent)
        if not scores:
            continue
        avg_score = round(sum(scores) / len(scores))
        avg_score = max(1, min(4, int(avg_score)))
        # Confidence: more matched sentences + more keyword hits → higher
        confidence = min(1.0, 0.25 + 0.15 * len(scores) + 0.05 * total_hits)
        dim, _ = lexicons[dim_id]
        results[dim_id] = TextQREResult(
            dim_id=dim_id,
            dim_name=dim.name,
            score=avg_score,
            confidence=round(confidence, 2),
            confidence_label=_confidence_label(confidence),
            evidence=evidence,
        )
    return results
