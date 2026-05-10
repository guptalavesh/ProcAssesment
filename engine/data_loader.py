from __future__ import annotations

import io
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import pandas as pd


class DataLoadError(Exception):
    """Raised when a data file fails validation."""


# ── Dataframe loaders ────────────────────────────────────────────────────────
# Each loader accepts a BytesIO (xlsx, xls or csv content), validates non-empty,
# and returns a DataFrame. Failures raise DataLoadError so the upload router
# can surface a friendly message.

def _read_any(bio: io.BytesIO) -> pd.DataFrame:
    """Sniff format from the buffer head and read xlsx/xls/csv into a DataFrame."""
    pos = bio.tell()
    head = bio.read(8)
    bio.seek(pos)
    try:
        if head.startswith(b"PK\x03\x04"):
            return pd.read_excel(bio, engine="openpyxl")
        if head[:4] in (b"\xd0\xcf\x11\xe0", b"\x09\x08\x10\x00"):
            return pd.read_excel(bio, engine="xlrd")
        text = head.decode("utf-8", errors="ignore")
        if text and any(c in text for c in (",", ";", "\t")):
            return pd.read_csv(bio)
        bio.seek(pos)
        return pd.read_excel(bio)
    except Exception as e:
        bio.seek(pos)
        try:
            return pd.read_csv(bio)
        except Exception:
            raise DataLoadError(f"Could not parse file: {e}")


def _normalised(df: pd.DataFrame) -> pd.DataFrame:
    """Strip whitespace from column names and drop wholly-empty rows."""
    if df is None or df.empty:
        return df
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df = df.dropna(how="all")
    return df


def _load_generic(bio: io.BytesIO, label: str, min_rows: int = 1) -> pd.DataFrame:
    df = _read_any(bio)
    df = _normalised(df)
    if df is None or len(df) < min_rows:
        raise DataLoadError(f"{label} file is empty or has too few rows.")
    return df


def load_po_dump(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "PO dump")


def load_pr_dump(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "PR dump")


def load_qre(bio: io.BytesIO) -> pd.DataFrame:
    """Questionnaire response file. Expected columns: dim_id, score (or
    question_code, score)."""
    return _load_generic(bio, "QRE")


def load_invoice(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Invoice")


def load_workforce(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Workforce")


def load_inventory(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Inventory")


def load_goods_movement(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Goods movement")


def load_po_gr(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "PO/GR")


def load_production(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Production")


def load_maintenance(bio: io.BytesIO) -> pd.DataFrame:
    return _load_generic(bio, "Maintenance")


# ── Bundle ───────────────────────────────────────────────────────────────────
@dataclass
class DataBundle:
    """Opaque container of all uploaded dataframes plus the resolved column map."""
    po_df:             Optional[pd.DataFrame] = None
    pr_df:             Optional[pd.DataFrame] = None
    qre_df:            Optional[pd.DataFrame] = None
    invoice_df:        Optional[pd.DataFrame] = None
    workforce_df:      Optional[pd.DataFrame] = None
    inventory_df:      Optional[pd.DataFrame] = None
    goods_movement_df: Optional[pd.DataFrame] = None
    po_gr_df:          Optional[pd.DataFrame] = None
    production_df:     Optional[pd.DataFrame] = None
    maintenance_df:    Optional[pd.DataFrame] = None
    quality_df:        Optional[pd.DataFrame] = None
    col_map:           Dict[str, str] = field(default_factory=dict)

    def get(self, name: str) -> Optional[pd.DataFrame]:
        return getattr(self, name, None)

    def col(self, logical: str) -> Optional[str]:
        """Resolve a logical column name to its actual header in the PO df."""
        return self.col_map.get(logical)

    def has_column(self, logical: str, df_name: str = "po_df") -> bool:
        df = self.get(df_name)
        actual = self.col_map.get(logical)
        return df is not None and actual is not None and actual in df.columns


def assemble_bundle(
    po_df: Optional[pd.DataFrame] = None,
    pr_df: Optional[pd.DataFrame] = None,
    qre_df: Optional[pd.DataFrame] = None,
    invoice_df: Optional[pd.DataFrame] = None,
    workforce_df: Optional[pd.DataFrame] = None,
    inventory_df: Optional[pd.DataFrame] = None,
    goods_movement_df: Optional[pd.DataFrame] = None,
    po_gr_df: Optional[pd.DataFrame] = None,
    production_df: Optional[pd.DataFrame] = None,
    maintenance_df: Optional[pd.DataFrame] = None,
    quality_df: Optional[pd.DataFrame] = None,
    col_map: Optional[Dict[str, str]] = None,
) -> DataBundle:
    """Bundle all dataframes plus the column map into a single object."""
    return DataBundle(
        po_df=po_df,
        pr_df=pr_df,
        qre_df=qre_df,
        invoice_df=invoice_df,
        workforce_df=workforce_df,
        inventory_df=inventory_df,
        goods_movement_df=goods_movement_df,
        po_gr_df=po_gr_df,
        production_df=production_df,
        maintenance_df=maintenance_df,
        quality_df=quality_df,
        col_map=dict(col_map or {}),
    )
