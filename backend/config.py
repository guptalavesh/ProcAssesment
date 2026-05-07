from __future__ import annotations
from pathlib import Path

BASE_DIR = Path(__file__).parent
OUTPUTS_DIR = BASE_DIR / "outputs"

COLOURS = {
    "leading":      "#2E7D32",
    "advanced":     "#1565C0",
    "intermediate": "#E65100",
    "foundation":   "#C62828",
    "insufficient": "#96968c",
}

SCORE_LABELS = {
    4: "Leading",
    3: "Advanced",
    2: "Intermediate",
    1: "Foundation",
}

# Scoring thresholds (upper-inclusive)
SCORE_THRESHOLDS = {
    "leading":      (3.5, 4.0),
    "advanced":     (2.5, 3.49),
    "intermediate": (1.5, 2.49),
    "foundation":   (0.0, 1.49),
}

BRAND_PURPLE = "#a100ff"
BRAND_DARK   = "#460073"
BRAND_MID    = "#7500c0"
