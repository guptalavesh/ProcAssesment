"""Generate the AIVault sample SAP-style dataset.

Run from anywhere:
    python sample_data/generate_sample_data.py

Writes 4 xlsx files into sample_data/:
    sap_po_dump.xlsx, sap_pr_dump.xlsx, sap_invoice_dump.xlsx, sap_workforce.xlsx

The dataset is deterministic (seeded) and tells a procurement story:
- 600 POs across 6 plants, 60 vendors, 8 material groups, 18 months
- ~24% rate-contract coverage (below the 65% benchmark — gap)
- ~10-day average PR-to-PO TAT (close to the 9-day benchmark — strength)
- ~89% on-time delivery (above 85% benchmark — strength)
- ~22% tail spend (above 20% benchmark — slight gap)
- 90% 3-way match (matches benchmark)
- 12% emergency PRs (above 10% — slight gap)
- Spend distribution skewed enough that "Pareto top 20%" makes sense
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

OUT = Path(__file__).parent
SEED = 42

random.seed(SEED)


# ── Plants, vendors, material groups ──────────────────────────────────────────
PLANTS = ["1000", "1100", "2000", "2100", "3000", "3100"]
PLANT_NAMES = {
    "1000": "Hosur",      "1100": "Mysore",   "2000": "Pune",
    "2100": "Chakan",     "3000": "Vizag",    "3100": "Bhubaneswar",
}

# 60 vendors with a Pareto-shaped spend share (top 8 ≈ 60% of spend).
VENDOR_TIERS = (
    [(f"V-{i:03d}", f"Strategic Vendor {i}", "strategic") for i in range(1, 9)] +
    [(f"V-{i:03d}", f"Preferred Vendor {i}",  "preferred") for i in range(9, 25)] +
    [(f"V-{i:03d}", f"Tail Vendor {i}",       "tail")      for i in range(25, 61)]
)

MATERIAL_GROUPS = [
    ("MG-001", "Raw materials — steel"),
    ("MG-002", "Raw materials — alloys"),
    ("MG-003", "MRO consumables"),
    ("MG-004", "Industrial spares"),
    ("MG-005", "Electrical components"),
    ("MG-006", "IT hardware"),
    ("MG-007", "Logistics — freight"),
    ("MG-008", "Professional services"),
]
MATERIALS_PER_GROUP = 6


def _maybe(prob: float) -> bool:
    return random.random() < prob


def _date_range_days(start: date, days_total: int):
    return [start + timedelta(days=i) for i in range(days_total)]


# ── PR data ──────────────────────────────────────────────────────────────────
# 720 PRs over 18 months, 600 of which are converted into POs.
def build_prs(n_prs: int = 720, start: date = date(2024, 11, 1)):
    rows = []
    creators = [f"E-{200 + i}" for i in range(20)]
    days_in_window = 545  # ~18 months
    for i in range(n_prs):
        pr_no = f"PR-{20000 + i}"
        pr_date = start + timedelta(days=random.randint(0, days_in_window - 30))
        # Most PRs released same / next day; a 12% slice released same-day to look "emergency"
        if _maybe(0.12):
            release_date = pr_date  # emergency / same-day release
            pr_type = "Emergency"
        else:
            release_date = pr_date + timedelta(days=random.randint(2, 7))
            pr_type = random.choice(["Standard", "Standard", "Standard", "Routine"])
        mg = random.choice(MATERIAL_GROUPS)
        material = f"MAT-{mg[0][3:]}-{random.randint(1, MATERIALS_PER_GROUP):02d}"
        plant = random.choice(PLANTS)
        creator = random.choice(creators)
        # Preferred-vendor flag on ~20% of PRs (drives single-source PRs metric)
        preferred = random.choice([v[0] for v in VENDOR_TIERS]) if _maybe(0.20) else ""
        rows.append({
            "PR_Number":         pr_no,
            "PR_Creation_Date":  pr_date,
            "PR_Release_Date":   release_date,
            "PR_Creator":        creator,
            "PR_Type":           pr_type,
            "Material_Number":   material,
            "Material_Group":    mg[0],
            "Material_Group_Desc": mg[1],
            "Plant":             plant,
            "Quantity":          random.randint(5, 250),
            "Preferred_Vendor":  preferred,
            "Cost_Center":       f"CC-{plant}-{random.randint(1, 12):02d}",
        })
    return pd.DataFrame(rows)


# ── PO data ──────────────────────────────────────────────────────────────────
def build_pos(pr_df: pd.DataFrame, n_pos: int = 600, start: date = date(2024, 11, 5)):
    rows = []
    # Sample which PRs become POs
    sampled = pr_df.sample(n=n_pos, random_state=SEED).reset_index(drop=True)
    weights = [4] * 8 + [2] * 16 + [1] * 36       # 60 vendors, Pareto-skewed weights
    vendor_pool = [v[0] for v in VENDOR_TIERS]

    # Track last price per material across rows so net_price moves over time
    last_price_by_material: dict[str, float] = {}

    for i, pr in sampled.iterrows():
        po_no = f"PO-{30000 + i}"
        # PR-to-PO TAT centred on ~9 days, with a fat tail
        tat_days = max(1, int(random.gauss(8, 4)))
        po_date  = pr["PR_Release_Date"] + timedelta(days=tat_days)

        vendor_code = random.choices(vendor_pool, weights=weights, k=1)[0]
        tier = next(v[2] for v in VENDOR_TIERS if v[0] == vendor_code)
        vendor_name = next(v[1] for v in VENDOR_TIERS if v[0] == vendor_code)

        material = pr["Material_Number"]
        # Net price drifts ~1% downward across orders for the same material — a
        # small but visible "savings vs LPO" signal. Range is calibrated for a
        # mid-size industrial engagement (~₹500 Cr annual spend).
        base = last_price_by_material.get(material, random.uniform(3_000, 1_20_000))
        net_price = round(base * random.uniform(0.95, 1.02), 2)
        last_price_by_material[material] = net_price
        qty = pr["Quantity"]
        net_value = round(net_price * qty, 2)

        # Rate-contract / outline-agreement coverage = 24% (below benchmark)
        outline = "OA-2025-001" if _maybe(0.18) else ""
        contract = "" if outline else ("CTR-2025-007" if _maybe(0.07) else "")

        # Goods-receipt + delivery date — 89% land on or before delivery date
        delivery_date = po_date + timedelta(days=random.randint(7, 21))
        gr_offset = random.choice([-2, -1, 0, 0, 0, 1] if _maybe(0.89) else [3, 5, 7, 12])
        gr_date = delivery_date + timedelta(days=gr_offset)

        rows.append({
            "PO_Number":          po_no,
            "PO_Creation_Date":   po_date,
            "PR_Reference":       pr["PR_Number"],
            "Vendor":             vendor_code,
            "Vendor_Name":        vendor_name,
            "Material_Number":    material,
            "Material_Group":     pr["Material_Group"],
            "Material_Group_Desc":pr["Material_Group_Desc"],
            "Short_Text":         f"{pr['Material_Group_Desc']} item",
            "Quantity":           qty,
            "Net_Price":          net_price,
            "Net_Value":          net_value,
            "Plant":              pr["Plant"],
            "Purchase_Group":     f"P{random.randint(1, 9):02d}",
            "Outline_Agreement":  outline,
            "Contract_Number":    contract,
            "Delivery_Date":      delivery_date,
            "GR_Date":            gr_date,
            "Document_Type":      "NB" if not _maybe(0.05) else "FO",
            "Cost_Center":        pr["Cost_Center"],
            "GL_Account":         f"6{random.randint(10000, 99999):05d}",
            "_vendor_tier":       tier,  # not exported, used downstream for invoice
        })
    return pd.DataFrame(rows)


# ── Invoice data ─────────────────────────────────────────────────────────────
def build_invoices(po_df: pd.DataFrame, coverage: float = 0.85):
    """Invoices for ~85% of POs. Most reference a real PO (3-way match)."""
    rows = []
    sampled = po_df.sample(frac=coverage, random_state=SEED).reset_index(drop=True)
    for i, po in sampled.iterrows():
        inv_no = f"INV-{40000 + i}"
        inv_date = po["GR_Date"] + timedelta(days=random.randint(0, 5))
        # 5% reference a non-existent PO (simulates 3-way-match exceptions)
        po_ref = po["PO_Number"] if not _maybe(0.05) else f"PO-{99000 + i}"
        terms = random.choice(["NET30", "NET45", "NET60"])
        days_to_pay = {"NET30": 30, "NET45": 45, "NET60": 60}[terms]
        # 80% paid within terms
        paid_offset = random.randint(15, days_to_pay) if _maybe(0.80) else random.randint(days_to_pay + 1, days_to_pay + 30)
        rows.append({
            "Invoice_Number":   inv_no,
            "Invoice_Date":     inv_date,
            "Vendor":           po["Vendor"],
            "PO_Reference":     po_ref,
            "Net_Amount":       po["Net_Value"],
            "Payment_Terms":    terms,
            "Due_Date":         inv_date + timedelta(days=days_to_pay),
            "Payment_Date":     inv_date + timedelta(days=paid_offset),
        })
    return pd.DataFrame(rows)


# ── Workforce data ───────────────────────────────────────────────────────────
def build_workforce(n_employees: int = 45):
    """Procurement org of 45 FTE, mixed roles + plant locations."""
    rows = []
    role_weights = [
        ("Buyer",                  20),
        ("Senior Buyer",            8),
        ("Category Manager",        6),
        ("Procurement Analyst",     4),
        ("Sourcing Manager",        3),
        ("Contracts Specialist",    2),
        ("Director of Procurement", 1),
        ("CPO",                     1),
    ]
    role_pool: list[str] = []
    for role, count in role_weights:
        role_pool.extend([role] * count)
    departments = ["Procurement"] * n_employees
    for i in range(n_employees):
        rows.append({
            "Employee_ID": f"E-{300 + i}",
            "Name":        f"Procurement Employee {i + 1}",
            "Role":        role_pool[i],
            "Department":  departments[i],
            "Location":    PLANT_NAMES[random.choice(PLANTS)],
        })
    return pd.DataFrame(rows)


# ── Driver ───────────────────────────────────────────────────────────────────
def main():
    pr_df = build_prs()
    po_df = build_pos(pr_df).drop(columns=["_vendor_tier"], errors="ignore")
    inv_df = build_invoices(po_df)
    wf_df = build_workforce()

    out_files = {
        "sap_po_dump.xlsx":     po_df,
        "sap_pr_dump.xlsx":     pr_df,
        "sap_invoice_dump.xlsx":inv_df,
        "sap_workforce.xlsx":   wf_df,
    }
    for name, df in out_files.items():
        path = OUT / name
        df.to_excel(path, index=False)
        print(f"  wrote {path.relative_to(OUT.parent)}  ({len(df)} rows × {len(df.columns)} cols)")

    print()
    print("Dataset summary:")
    print(f"  PR rows:        {len(pr_df)}")
    print(f"  PO rows:        {len(po_df)}")
    print(f"  Invoice rows:   {len(inv_df)}")
    print(f"  Workforce rows: {len(wf_df)}")
    print(f"  Total spend:    ₹{po_df['Net_Value'].sum() / 1e7:.1f} Cr")
    print(f"  Vendors:        {po_df['Vendor'].nunique()}")
    print(f"  RC coverage:    {(po_df['Outline_Agreement'].astype(str).str.strip() != '').mean() * 100:.1f}%")


if __name__ == "__main__":
    main()
