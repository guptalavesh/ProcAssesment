"""Generate the AIVault chemical-industry FY26 test dataset.

Run:
    python test_data/generate_test_data.py

Writes 4 xlsx files into test_data/:
    chem_po_dump.xlsx, chem_pr_dump.xlsx, chem_invoice_dump.xlsx, chem_workforce.xlsx

Profile — mid-size Indian chemicals manufacturer, FY26 (Apr 2025 → Mar 2026):
- 8 plants across Gujarat / Maharashtra / Telangana / AP
- 80 vendors (10 strategic, 25 preferred, 45 tail)
- 10 material groups (raw materials → catalysts → packaging → MRO)
- ~₹1,800 Cr annual spend, 100 procurement FTE
- 800 POs, 950 PRs, 700 invoices, 100 workforce rows

Story baked into the data:
- RC adoption ~58% (better than the steel sample — chemicals are more
  contract-driven for commodity feedstocks)
- PR-to-PO TAT ~11 days (slightly above the 9-day benchmark)
- OTD ~83% (supply-chain volatility typical of chemicals — below benchmark)
- Emergency PRs ~16% (process upsets / catalyst urgency)
- 3-way match ~93%
- Tail spend ~14%
- Spend per FTE ~₹18 Cr (at benchmark for mid-size chem)

Expected overall maturity: ~2.2–2.5 (Intermediate, trending Advanced).
Headline gaps: OTD recovery + emergency-PR demand planning.
"""
from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

OUT = Path(__file__).parent
SEED = 26  # FY26 — fitting

random.seed(SEED)

# ── Indian fiscal year FY26: Apr 2025 → Mar 2026 ──────────────────────────────
FY_START = date(2025, 4, 1)
FY_END   = date(2026, 3, 31)
DAYS_IN_FY = (FY_END - FY_START).days  # 364


# ── Plants (Indian chemical manufacturing hubs) ──────────────────────────────
PLANTS = ["VAPI", "DAHJ", "ANKL", "MNLI", "VSKP", "VDRA", "JMNG", "HYDB"]
PLANT_NAMES = {
    "VAPI": "Vapi (Gujarat)",
    "DAHJ": "Dahej (Gujarat)",
    "ANKL": "Ankleshwar (Gujarat)",
    "MNLI": "Manali (Tamil Nadu)",
    "VSKP": "Visakhapatnam (Andhra Pradesh)",
    "VDRA": "Vadodara (Gujarat)",
    "JMNG": "Jamnagar (Gujarat)",
    "HYDB": "Hyderabad (Telangana)",
}


# ── Vendor catalogue (chemical-specific, Pareto-shaped) ──────────────────────
STRATEGIC_VENDORS = [
    ("V-001", "BASF India Ltd"),
    ("V-002", "Reliance Industries Ltd"),
    ("V-003", "Tata Chemicals Ltd"),
    ("V-004", "SRF Limited"),
    ("V-005", "Aarti Industries Ltd"),
    ("V-006", "Solvay Asia Pacific"),
    ("V-007", "Indian Oil Corporation"),
    ("V-008", "Linde India Ltd"),
    ("V-009", "Atul Limited"),
    ("V-010", "PI Industries Ltd"),
]
PREFERRED_VENDORS = [
    (f"V-{11 + i:03d}",
     name)
    for i, name in enumerate([
        "Deepak Nitrite", "Vinati Organics", "Navin Fluorine",
        "Gujarat Fluorochemicals", "Alkyl Amines", "Galaxy Surfactants",
        "Clariant Chemicals India", "Anupam Rasayan", "Heubach Colour",
        "Privi Speciality", "Camlin Fine Sciences", "Excel Industries",
        "Fineotex Chemical", "Bodal Chemicals", "Meghmani Organics",
        "Dishman Carbogen Amcis", "Sharda Cropchem", "Sudarshan Chemical",
        "IOL Chemicals", "Bharat Rasayan",
        "GreenLogix Logistics", "Blue Dart Express", "Concor Logistics",
        "Honeywell Process Solutions", "Schneider Electric India",
    ])
]
TAIL_VENDORS = [
    (f"V-{36 + i:03d}", f"Tail vendor {i + 1}") for i in range(45)
]
VENDOR_TIERS = (
    [(c, n, "strategic") for c, n in STRATEGIC_VENDORS] +
    [(c, n, "preferred") for c, n in PREFERRED_VENDORS] +
    [(c, n, "tail")      for c, n in TAIL_VENDORS]
)


# ── Material groups (chemical-industry taxonomy) ─────────────────────────────
MATERIAL_GROUPS = [
    ("MG-001", "Raw materials — bulk chemicals"),
    ("MG-002", "Raw materials — intermediates"),
    ("MG-003", "Solvents"),
    ("MG-004", "Catalysts & specialty inputs"),
    ("MG-005", "Packaging — drums, IBCs, bags"),
    ("MG-006", "Engineering spares — pumps, valves, instrumentation"),
    ("MG-007", "Lab supplies & reagents"),
    ("MG-008", "Industrial gases & fuels"),
    ("MG-009", "MRO consumables"),
    ("MG-010", "Logistics — freight & warehousing"),
]
MATERIALS_PER_GROUP = 10


# Chemical companies are RC-driven for commodity feedstocks; higher base
# probability than the steel sample (~24% → ~58% here).
RC_COVERAGE_BY_GROUP = {
    "MG-001": 0.78,  # bulk feedstocks — heavily contracted
    "MG-002": 0.72,
    "MG-003": 0.68,
    "MG-004": 0.40,  # specialty / catalysts — more spot buying
    "MG-005": 0.55,
    "MG-006": 0.30,  # engineering — project-driven
    "MG-007": 0.25,
    "MG-008": 0.85,  # gases / fuels — almost all on contracts
    "MG-009": 0.20,
    "MG-010": 0.60,
}

# Price scale per material group — roughly calibrated so the 800-PO mix
# rolls up to ~₹1,800 Cr / FY (mid-size chemicals).
PRICE_BAND_BY_GROUP = {
    "MG-001": (15_000, 1_50_000),    # bulk chemicals
    "MG-002": (20_000, 2_50_000),
    "MG-003": (8_000, 1_20_000),
    "MG-004": (50_000, 5_00_000),    # catalysts run high
    "MG-005": (5_000, 80_000),
    "MG-006": (10_000, 3_00_000),    # engineering spares
    "MG-007": (2_000, 40_000),
    "MG-008": (3_000, 60_000),
    "MG-009": (1_000, 20_000),
    "MG-010": (5_000, 80_000),
}


def _maybe(prob: float) -> bool:
    return random.random() < prob


# ── PRs ──────────────────────────────────────────────────────────────────────
# 950 PRs across FY26. Most are released within 2-7 days; ~16% same-day
# (emergency / process-upset).
def build_prs(n_prs: int = 950, start: date = FY_START):
    rows = []
    creators = [f"E-{500 + i}" for i in range(40)]
    for i in range(n_prs):
        pr_no = f"PR-{50000 + i}"
        pr_date = start + timedelta(days=random.randint(0, DAYS_IN_FY - 21))
        if _maybe(0.16):
            release_date = pr_date
            pr_type = "Emergency"
        else:
            release_date = pr_date + timedelta(days=random.randint(2, 7))
            pr_type = random.choice(["Standard"] * 5 + ["Routine"] * 2 + ["Project"])
        mg = random.choice(MATERIAL_GROUPS)
        material = f"CHM-{mg[0][3:]}-{random.randint(1, MATERIALS_PER_GROUP):02d}"
        plant = random.choice(PLANTS)
        creator = random.choice(creators)
        # ~25% of PRs name a preferred vendor (single-source / PAC signal)
        preferred = random.choice([v[0] for v in VENDOR_TIERS]) if _maybe(0.25) else ""
        rows.append({
            "PR_Number":           pr_no,
            "PR_Creation_Date":    pr_date,
            "PR_Release_Date":     release_date,
            "PR_Creator":          creator,
            "PR_Type":             pr_type,
            "Material_Number":     material,
            "Material_Group":      mg[0],
            "Material_Group_Desc": mg[1],
            "Plant":               plant,
            "Quantity":            random.randint(10, 500),
            "Preferred_Vendor":    preferred,
            "Cost_Center":         f"CC-{plant}-{random.randint(1, 18):02d}",
        })
    return pd.DataFrame(rows)


# ── POs ──────────────────────────────────────────────────────────────────────
def build_pos(pr_df: pd.DataFrame, n_pos: int = 800):
    rows = []
    sampled = pr_df.sample(n=n_pos, random_state=SEED).reset_index(drop=True)
    # Pareto-skewed vendor selection: 10 strategic get heavy weights,
    # 25 preferred medium, 45 tail thin.
    weights = [6] * 10 + [2] * 25 + [1] * 45
    vendor_pool = [v[0] for v in VENDOR_TIERS]

    last_price_by_material: dict[str, float] = {}

    for i, pr in sampled.iterrows():
        po_no = f"PO-{60000 + i}"
        # PR-to-PO TAT ~11 days (slightly above benchmark)
        tat_days = max(1, int(random.gauss(11, 5)))
        po_date  = pr["PR_Release_Date"] + timedelta(days=tat_days)
        if po_date > FY_END:
            po_date = FY_END

        vendor_code = random.choices(vendor_pool, weights=weights, k=1)[0]
        vendor_name = next(v[1] for v in VENDOR_TIERS if v[0] == vendor_code)

        material = pr["Material_Number"]
        mg = pr["Material_Group"]
        lo, hi = PRICE_BAND_BY_GROUP.get(mg, (10_000, 1_00_000))
        base = last_price_by_material.get(material, random.uniform(lo, hi))
        # Prices drift slightly down (~1-2% per cycle) — savings vs LPO signal
        net_price = round(base * random.uniform(0.95, 1.02), 2)
        last_price_by_material[material] = net_price
        qty = pr["Quantity"]
        net_value = round(net_price * qty, 2)

        # RC coverage by material group — chemical industry is more
        # contract-driven than steel.
        rc_prob = RC_COVERAGE_BY_GROUP.get(mg, 0.30)
        outline = "OA-FY26-" + str(random.randint(1, 24)).zfill(3) if _maybe(rc_prob) else ""
        contract = "" if outline else ("CTR-FY26-" + str(random.randint(1, 12)).zfill(3) if _maybe(0.10) else "")

        # Delivery + GR — OTD ~83% (slightly below benchmark)
        delivery_date = po_date + timedelta(days=random.randint(7, 28))
        # On-time branch: GR posted at or before the requested date.
        # Late branch: 3-14 days late.
        if _maybe(0.83):
            gr_offset = random.choice([-2, -1, -1, 0])  # all ≤ 0 → on-time
        else:
            gr_offset = random.choice([3, 5, 8, 14])
        gr_date = delivery_date + timedelta(days=gr_offset)
        if gr_date > FY_END:
            gr_date = FY_END

        rows.append({
            "PO_Number":           po_no,
            "PO_Creation_Date":    po_date,
            "PR_Reference":        pr["PR_Number"],
            "Vendor":              vendor_code,
            "Vendor_Name":         vendor_name,
            "Material_Number":     material,
            "Material_Group":      mg,
            "Material_Group_Desc": pr["Material_Group_Desc"],
            "Short_Text":          f"{pr['Material_Group_Desc']} item",
            "Quantity":            qty,
            "Net_Price":           net_price,
            "Net_Value":           net_value,
            "Plant":               pr["Plant"],
            "Purchase_Group":      f"P{random.randint(1, 12):02d}",
            "Outline_Agreement":   outline,
            "Contract_Number":     contract,
            "Delivery_Date":       delivery_date,
            "GR_Date":             gr_date,
            "Document_Type":       "NB" if not _maybe(0.05) else "FO",
            "Cost_Center":         pr["Cost_Center"],
            "GL_Account":          f"6{random.randint(10000, 99999):05d}",
        })
    return pd.DataFrame(rows)


# ── Invoices ─────────────────────────────────────────────────────────────────
def build_invoices(po_df: pd.DataFrame, coverage: float = 0.88):
    """Invoices for ~88% of POs. ~7% of invoices reference an unknown PO
    (3-way match exception signal)."""
    rows = []
    sampled = po_df.sample(frac=coverage, random_state=SEED).reset_index(drop=True)
    for i, po in sampled.iterrows():
        inv_no = f"INV-{70000 + i}"
        inv_date = po["GR_Date"] + timedelta(days=random.randint(0, 7))
        if inv_date > FY_END:
            inv_date = FY_END
        po_ref = po["PO_Number"] if not _maybe(0.07) else f"PO-{99000 + i}"
        terms = random.choice(["NET30", "NET45", "NET60", "NET90"])
        terms_days = {"NET30": 30, "NET45": 45, "NET60": 60, "NET90": 90}[terms]
        paid_offset = (random.randint(15, terms_days) if _maybe(0.78)
                       else random.randint(terms_days + 1, terms_days + 35))
        rows.append({
            "Invoice_Number":   inv_no,
            "Invoice_Date":     inv_date,
            "Vendor":           po["Vendor"],
            "PO_Reference":     po_ref,
            "Net_Amount":       po["Net_Value"],
            "Payment_Terms":    terms,
            "Due_Date":         inv_date + timedelta(days=terms_days),
            "Payment_Date":     inv_date + timedelta(days=paid_offset),
        })
    return pd.DataFrame(rows)


# ── Workforce ────────────────────────────────────────────────────────────────
def build_workforce(n_employees: int = 100):
    """Procurement org — 100 FTE for a mid-size chemical company."""
    rows = []
    role_weights = [
        ("Buyer",                  40),
        ("Senior Buyer",           18),
        ("Category Manager",       14),
        ("Procurement Analyst",     8),
        ("Sourcing Manager",        7),
        ("Contracts Specialist",    5),
        ("Risk & Compliance Lead",  3),
        ("Sustainability Lead",     2),
        ("Director of Procurement", 2),
        ("CPO",                     1),
    ]
    role_pool: list[str] = []
    for role, count in role_weights:
        role_pool.extend([role] * count)
    for i in range(n_employees):
        rows.append({
            "Employee_ID": f"E-{500 + i}",
            "Name":        f"Procurement Employee {i + 1}",
            "Role":        role_pool[i],
            "Department":  "Procurement",
            "Location":    PLANT_NAMES[random.choice(PLANTS)],
        })
    return pd.DataFrame(rows)


def main():
    pr_df = build_prs()
    po_df = build_pos(pr_df)
    inv_df = build_invoices(po_df)
    wf_df = build_workforce()

    files = {
        "chem_po_dump.xlsx":      po_df,
        "chem_pr_dump.xlsx":      pr_df,
        "chem_invoice_dump.xlsx": inv_df,
        "chem_workforce.xlsx":    wf_df,
    }
    for name, df in files.items():
        path = OUT / name
        df.to_excel(path, index=False)
        print(f"  wrote {path.relative_to(OUT.parent)}  ({len(df)} rows × {len(df.columns)} cols)")

    print()
    print("FY26 dataset summary")
    print(f"  Period:         {FY_START} → {FY_END}")
    print(f"  PR rows:        {len(pr_df)}")
    print(f"  PO rows:        {len(po_df)}")
    print(f"  Invoice rows:   {len(inv_df)}")
    print(f"  Workforce:      {len(wf_df)}")
    print(f"  Total spend:    ₹{po_df['Net_Value'].sum() / 1e7:.1f} Cr")
    print(f"  Vendors:        {po_df['Vendor'].nunique()}")
    print(f"  RC coverage:    {(po_df['Outline_Agreement'].astype(str).str.strip() != '').mean() * 100:.1f}%")


if __name__ == "__main__":
    main()
