from __future__ import annotations
import io
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, File, UploadFile

router = APIRouter(tags=["file_inspect"])

# File slot signatures — column patterns that identify each slot type
SLOT_SIGNATURES = {
    "po_file": {
        "keywords": ["po_number","purchase_order","purchasing document","ebeln","vendor","net_value","po_creation"],
        "required": ["vendor", "net_value"],
    },
    "pr_file": {
        "keywords": ["pr_number","purchase_requisition","pr_creation","banfn","requisition","pr_date","pr_creator"],
        "required": ["pr_number","pr_creation"],
    },
    "invoice_file": {
        "keywords": ["invoice","invoice_number","invoice_date","belnr","payment_terms","due_date"],
        "required": ["invoice"],
    },
    "qre_file": {
        "keywords": ["dimension","score","qre","questionnaire","maturity","assessment","d1","d2","d3"],
        "required": ["score","dimension"],
    },
    "workforce_file": {
        "keywords": ["employee","headcount","fte","workforce","role","designation","department"],
        "required": ["employee"],
    },
    "quality_file": {
        "keywords": ["defect","rejection","quality","inspection","ncr","quality_rejection"],
        "required": ["defect","quality"],
    },
    "inventory_file": {
        "keywords": ["inventory","stock","mb52","mmbe","storage_location","unrestricted","plant_stock"],
        "required": ["stock","inventory"],
    },
    "goods_movement_file": {
        "keywords": ["goods_movement","mb51","movement_type","mvt_type","transfer","posting_date","qty_transferred"],
        "required": ["movement","goods"],
    },
    "po_gr_file": {
        "keywords": ["gr_date","goods_receipt","migo","me2m","delivery_completed","gr_qty"],
        "required": ["gr_date","goods_receipt"],
    },
    "production_file": {
        "keywords": ["production","order","coois","basic_start","basic_finish","confirmation","work_center"],
        "required": ["production","order"],
    },
    "maintenance_file": {
        "keywords": ["maintenance","iw38","order_type","functional_location","equipment","malfunction","pm_order"],
        "required": ["maintenance","equipment"],
    },
}

FILENAME_HINTS = {
    "po": "po_file", "purchase_order": "po_file", "me2n": "po_file",
    "pr": "pr_file", "purchase_req": "pr_file", "me5a": "pr_file",
    "invoice": "invoice_file", "ap_data": "invoice_file", "mir5": "invoice_file",
    "qre": "qre_file", "questionnaire": "qre_file",
    "workforce": "workforce_file", "headcount": "workforce_file", "fte": "workforce_file",
    "quality": "quality_file", "rejection": "quality_file", "defect": "quality_file",
    "inventory": "inventory_file", "mb52": "inventory_file", "stock": "inventory_file",
    "goods_movement": "goods_movement_file", "mb51": "goods_movement_file",
    "po_gr": "po_gr_file", "gr_data": "po_gr_file", "migo": "po_gr_file",
    "production": "production_file", "coois": "production_file",
    "maintenance": "maintenance_file", "iw38": "maintenance_file",
}


def _score_columns(columns: List[str], slot_key: str) -> float:
    sig = SLOT_SIGNATURES.get(slot_key, {})
    keywords = sig.get("keywords", [])
    if not keywords: return 0.0
    col_lower = [c.lower().replace(" ","_") for c in columns]
    col_str = " ".join(col_lower)
    hits = sum(1 for kw in keywords if kw.lower() in col_str)
    return hits / len(keywords)


def _classify_sheet(columns: List[str], filename: str, sheet_name: str) -> tuple[str, str, str]:
    """Return (suggested_slot, confidence, reasoning)."""
    fn_lower = filename.lower().replace(" ","_").replace("-","_")
    for hint, slot in FILENAME_HINTS.items():
        if hint in fn_lower:
            score = _score_columns(columns, slot)
            if score >= 0.15:
                return slot, "high", f"Filename contains '{hint}' → {slot}"

    scores = {}
    for slot_key in SLOT_SIGNATURES:
        scores[slot_key] = _score_columns(columns, slot_key)
    best_slot = max(scores, key=scores.get)
    best_score = scores[best_slot]
    if best_score >= 0.30:
        confidence = "high" if best_score >= 0.50 else "medium"
        return best_slot, confidence, f"Column pattern match ({best_score:.0%} keywords matched)"
    elif best_score >= 0.10:
        return best_slot, "low", f"Weak column match ({best_score:.0%}) — please verify"
    else:
        return "po_file", "low", "Could not classify — defaulting to PO"


@router.post("/files/inspect")
async def inspect_files(files: List[UploadFile] = File(...)):
    results = []
    for upload in files:
        filename = upload.filename or "unknown"
        data = await upload.read()
        size_kb = round(len(data) / 1024, 1)
        if not data:
            results.append({"filename": filename, "size_kb": 0, "sheets": [],
                            "error": "Empty file"})
            continue
        bio = io.BytesIO(data)
        try:
            if filename.lower().endswith((".xlsx", ".xls")):
                xl = pd.ExcelFile(bio)
                sheets = []
                for sheet_name in xl.sheet_names:
                    try:
                        df = xl.parse(sheet_name, nrows=5)
                        columns = list(df.columns)
                        slot, conf, reasoning = _classify_sheet(columns, filename, sheet_name)
                        sheets.append({
                            "name": sheet_name,
                            "columns": columns[:20],
                            "row_count_sample": len(df),
                            "suggested_slot": slot,
                            "confidence": conf,
                            "reasoning": reasoning,
                        })
                    except Exception as e:
                        sheets.append({"name": sheet_name, "error": str(e),
                                       "suggested_slot": "po_file", "confidence": "low"})
                results.append({"filename": filename, "size_kb": size_kb, "sheets": sheets})
            else:  # CSV
                df = pd.read_csv(bio, nrows=5, on_bad_lines="skip")
                columns = list(df.columns)
                slot, conf, reasoning = _classify_sheet(columns, filename, "(csv)")
                results.append({"filename": filename, "size_kb": size_kb, "sheets": [{
                    "name": "(csv)", "columns": columns[:20],
                    "row_count_sample": len(df),
                    "suggested_slot": slot, "confidence": conf, "reasoning": reasoning,
                }]})
        except Exception as e:
            results.append({"filename": filename, "size_kb": size_kb,
                            "sheets": [], "error": str(e)})
    return {"files": results}
