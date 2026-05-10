from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


# ── Standard SAP/procurement column aliases ──────────────────────────────────
# Logical name → list of common header variants. The column resolver uses
# these synonyms (and falls back to fuzzy matching) to map uploaded files.
COLUMN_ALIASES: Dict[str, List[str]] = {
    # PO
    "po_number":        ["PO_Number", "Purchase_Order", "Doc_No", "PO No", "Purchasing Document"],
    "po_date":          ["PO_Creation_Date", "PO_Date", "Document_Date", "Posting_Date", "PO Doc Date"],
    "vendor":           ["Vendor", "Vendor_Code", "Supplier", "Supplier_Code", "Vendor No"],
    "vendor_name":      ["Vendor_Name", "Supplier_Name", "Name_1"],
    "material_number":  ["Material_Number", "Material", "Item_No", "Part_No", "SKU"],
    "short_text":       ["Short_Text", "Material_Description", "Item_Text", "Description"],
    "quantity":         ["Quantity", "Order_Quantity", "PO_Qty", "Qty"],
    "net_value":        ["Net_Value", "PO_Value", "Total_Value", "Order_Value", "Net_Amount", "Amount"],
    "net_price":        ["Net_Price", "Unit_Price", "Price_Per_Unit", "Unit Cost"],
    "plant":            ["Plant", "Plant_Code"],
    "purchase_group":   ["Purchase_Group", "Purchasing_Group", "Purch_Group", "PGr"],
    "material_group":   ["Material_Group", "Material_Grp", "MatGrp", "Mat_Group"],
    "material_group_desc": ["Material_Group_Desc", "MatGrp_Desc", "Material_Group_Description"],
    "outline_agreement":["Outline_Agreement", "Framework_Order", "Value_Contract"],
    "contract_number":  ["Contract_Number", "Contract_No", "Agmt_No"],
    "gr_date":          ["GR_Date", "Goods_Receipt_Date", "Entry_Date", "MIGO_Date"],
    "pr_delivery_date": ["Delivery_Date", "Sched_Del_Date", "Requested_Delivery_Date"],
    "pr_reference":     ["PR_Reference", "PR_Ref", "Requisition_No", "Purch_Req"],
    "po_type":          ["Document_Type", "Order_Type", "PO_Type"],
    "cost_center":      ["Cost_Center", "WBS_Element", "Account_Assignment"],
    "gl_account":       ["GL_Account", "G_L_Account", "Account"],
    # PR-owned (same logical names but expected on PR file)
    "pr_number":        ["PR_Number", "PR_No", "Purchase_Requisition", "Requisition_No"],
    "pr_date":          ["PR_Creation_Date", "PR_Date", "Requisition_Date", "Created_On"],
    "pr_creation_date": ["PR_Creation_Date", "PR_Date", "Requisition_Date", "Created_On"],
    "pr_release_date":  ["PR_Release_Date", "Release_Date", "Approval_Date"],
    "pr_creator":       ["PR_Creator", "Created_By", "Requestor"],
    "pr_item":          ["PR_Item", "Item", "Line_Item"],
    # Invoice
    "invoice_number":   ["Invoice_Number", "Invoice_No", "Document_Number"],
    "invoice_date":     ["Invoice_Date", "Posting_Date"],
    "invoice_amount":   ["Invoice_Amount", "Net_Amount", "Total"],
    "payment_date":     ["Payment_Date", "Clearing_Date"],
    "due_date":         ["Due_Date", "Baseline_Date"],
    "payment_terms":    ["Payment_Terms", "Terms_of_Payment"],
    # Workforce
    "employee_id":      ["Employee_ID", "Emp_ID", "Personnel_No"],
    "employee_name":    ["Name", "Employee_Name", "Full_Name"],
    "role":             ["Role", "Job_Title", "Designation"],
    "department":       ["Department", "Dept", "Function"],
    "location":         ["Location", "Plant", "Site"],
}


@dataclass
class Dimension:
    id: str
    name: str
    weight: float
    kpis: List[str] = field(default_factory=list)


@dataclass
class Skill:
    path: str
    display_name: str
    function_name: str
    dimensions: Dict[str, Dimension]
    column_aliases: Dict[str, List[str]] = field(default_factory=dict)
    schema_version: str = "1.0"
    raw_yaml: Dict[str, Any] = field(default_factory=dict)


_DIMENSIONS: List[Dimension] = [
    Dimension("D1",  "Strategy & Governance",        0.10, kpis=[]),
    Dimension("D2",  "Spend Visibility & Analytics", 0.08, kpis=["tail_spend", "spend_per_fte"]),
    Dimension("D3",  "Category Management",          0.10, kpis=["rc_adoption_volume"]),
    Dimension("D4",  "Sourcing & Contracting",       0.10, kpis=["rc_adoption_volume", "savings_per_lpo"]),
    Dimension("D5",  "Supplier Management",          0.08, kpis=["otd"]),
    Dimension("D6",  "Operational Procurement",      0.10, kpis=["tat_pr_to_po", "emergency_pr_pct"]),
    Dimension("D7",  "Purchase-to-Pay Process",      0.08, kpis=["pac_3way_match"]),
    Dimension("D8",  "Risk & Compliance",            0.08, kpis=["pac_3way_match", "emergency_pr_pct"]),
    Dimension("D9",  "Digital & Technology",         0.08, kpis=[]),
    Dimension("D10", "People & Organisation",        0.08, kpis=["spend_per_fte"]),
    Dimension("D11", "Sustainability",               0.06, kpis=[]),
    Dimension("D12", "Value Delivery",               0.08, kpis=["savings_per_lpo"]),
    Dimension("D13", "Innovation",                   0.06, kpis=[]),
]

_SCALE = [
    {"score": 1, "label": "Foundation — not in place"},
    {"score": 2, "label": "Intermediate — partially in place"},
    {"score": 3, "label": "Advanced — mostly in place"},
    {"score": 4, "label": "Leading — fully deployed"},
]

_QUESTION_BANK: Dict[str, Dict[str, Any]] = {
    "D1": {
        "title": "Strategy & Governance",
        "guidance": "Procurement vision, mandate, operating model and decision rights.",
        "questions": [
            ("D1Q1", "A documented procurement strategy exists and is aligned to enterprise goals.", True),
            ("D1Q2", "Governance forums review procurement performance on a defined cadence.", False),
            ("D1Q3", "Roles, responsibilities and decision rights are formally documented.", False),
            ("D1Q4", "Procurement KPIs cascade from strategy to category and team level.", False),
        ],
    },
    "D2": {
        "title": "Spend Visibility & Analytics",
        "guidance": "Quality and reach of spend data, classification and analytics tooling.",
        "questions": [
            ("D2Q1", "Spend is consolidated across entities into a single source of truth.", True),
            ("D2Q2", "A consistent category taxonomy is applied to all transactions.", False),
            ("D2Q3", "Self-service dashboards are available to category managers.", False),
            ("D2Q4", "Advanced analytics (predictive / prescriptive) inform category decisions.", False),
        ],
    },
    "D3": {
        "title": "Category Management",
        "guidance": "Maturity of category strategies, market intelligence and savings pipelines.",
        "questions": [
            ("D3Q1", "Category strategies are documented and refreshed on a defined cadence.", True),
            ("D3Q2", "Market intelligence feeds category planning.", False),
            ("D3Q3", "A savings pipeline is tracked end-to-end with finance sign-off.", False),
            ("D3Q4", "Cross-functional category councils drive demand and specification levers.", False),
        ],
    },
    "D4": {
        "title": "Sourcing & Contracting",
        "guidance": "Strategic sourcing playbooks, e-sourcing adoption and contract lifecycle.",
        "questions": [
            ("D4Q1", "A standard sourcing playbook is followed for material events.", True),
            ("D4Q2", "An e-sourcing tool is used for the majority of competitive events.", False),
            ("D4Q3", "Contracts are stored in a central repository with metadata search.", False),
            ("D4Q4", "Contract clauses, obligations and renewals are actively managed.", False),
        ],
    },
    "D5": {
        "title": "Supplier Management",
        "guidance": "Segmentation, performance management and supplier development.",
        "questions": [
            ("D5Q1", "Suppliers are segmented (e.g. strategic / preferred / transactional).", True),
            ("D5Q2", "Performance scorecards are issued to strategic suppliers.", False),
            ("D5Q3", "Joint business plans / innovation programmes exist with key suppliers.", False),
            ("D5Q4", "Supplier diversity and inclusion is actively measured.", False),
        ],
    },
    "D6": {
        "title": "Operational Procurement",
        "guidance": "Day-to-day buying channels, catalogues and requisition compliance.",
        "questions": [
            ("D6Q1", "Catalogues / preferred buying channels cover the bulk of indirect spend.", True),
            ("D6Q2", "Requisitions route through automated approval workflows.", False),
            ("D6Q3", "Maverick / off-contract spend is measured and actioned.", False),
            ("D6Q4", "Touchless PO creation rate is tracked and improving.", False),
        ],
    },
    "D7": {
        "title": "Purchase-to-Pay Process",
        "guidance": "PO, GR and invoice processing efficiency, automation and exceptions.",
        "questions": [
            ("D7Q1", "Three-way match is enforced systemically for goods invoices.", True),
            ("D7Q2", "Invoice processing is largely automated (OCR / e-invoicing).", False),
            ("D7Q3", "Exception queues are monitored with defined SLAs.", False),
            ("D7Q4", "First-time-right invoice rate is tracked.", False),
        ],
    },
    "D8": {
        "title": "Risk & Compliance",
        "guidance": "Third-party risk, regulatory compliance and policy adherence.",
        "questions": [
            ("D8Q1", "A third-party risk framework covers financial, cyber and ESG risks.", True),
            ("D8Q2", "Critical suppliers undergo periodic re-assessment.", False),
            ("D8Q3", "Policy compliance (e.g. segregation of duties) is auditable.", False),
            ("D8Q4", "Sanction / watch-list screening is automated.", False),
        ],
    },
    "D9": {
        "title": "Digital & Technology",
        "guidance": "Coverage and integration of source-to-pay technology and data backbone.",
        "questions": [
            ("D9Q1", "A core S2P / P2P platform is deployed across the organisation.", True),
            ("D9Q2", "Master data (vendor, material, category) is governed centrally.", False),
            ("D9Q3", "Integrations with ERP and adjacent systems are stable and monitored.", False),
            ("D9Q4", "AI / automation use cases are in production beyond pilots.", False),
        ],
    },
    "D10": {
        "title": "People & Organisation",
        "guidance": "Capability model, talent management and operating model design.",
        "questions": [
            ("D10Q1", "A capability framework defines required skills by role.", True),
            ("D10Q2", "Training and certification plans are in place and tracked.", False),
            ("D10Q3", "Career paths and succession plans exist for procurement roles.", False),
            ("D10Q4", "Operating model is reviewed against business needs at a defined cadence.", False),
        ],
    },
    "D11": {
        "title": "Sustainability",
        "guidance": "Sustainable sourcing, scope-3 emissions and circularity initiatives.",
        "questions": [
            ("D11Q1", "Sustainability criteria are embedded in sourcing decisions.", True),
            ("D11Q2", "Scope-3 emissions are measured for material categories.", False),
            ("D11Q3", "Supplier sustainability performance is tracked.", False),
            ("D11Q4", "Circular-economy / reuse initiatives are active.", False),
        ],
    },
    "D12": {
        "title": "Value Delivery",
        "guidance": "Savings tracking, value beyond savings, and stakeholder satisfaction.",
        "questions": [
            ("D12Q1", "Savings are validated by finance and reflected in budgets.", True),
            ("D12Q2", "Value beyond savings (risk, ESG, innovation) is reported.", False),
            ("D12Q3", "Stakeholder satisfaction is measured periodically.", False),
            ("D12Q4", "Working-capital / cash impact of procurement actions is tracked.", False),
        ],
    },
    "D13": {
        "title": "Innovation",
        "guidance": "Supplier-led innovation, ideation channels and venturing.",
        "questions": [
            ("D13Q1", "A formal channel exists to capture supplier-led innovation ideas.", True),
            ("D13Q2", "Innovation pilots are funded and tracked through to scale.", False),
            ("D13Q3", "Procurement engages with start-ups / venture ecosystems.", False),
            ("D13Q4", "Innovation outcomes feed category strategy refreshes.", False),
        ],
    },
}


def _build_skill(path: str, display_name: str, function_name: str) -> Skill:
    dims = {d.id: d for d in _DIMENSIONS}
    questionnaire = {}
    for dim_id, block in _QUESTION_BANK.items():
        questionnaire[dim_id] = {
            "title": block["title"],
            "guidance": block["guidance"],
            "questions": [
                {"code": code, "text": text, "mandatory": mandatory, "options": _SCALE}
                for code, text, mandatory in block["questions"]
            ],
        }
    return Skill(
        path=path,
        display_name=display_name,
        function_name=function_name,
        dimensions=dims,
        column_aliases=COLUMN_ALIASES,
        schema_version="1.0",
        raw_yaml={"questionnaire": questionnaire},
    )


_SKILLS: Dict[str, Skill] = {
    "procurement_maturity_baseline": _build_skill(
        path="procurement_maturity_baseline",
        display_name="Procurement Maturity — Baseline",
        function_name="procurement_maturity",
    ),
}


def list_skills() -> List[Skill]:
    return list(_SKILLS.values())


def load_skill(skill_path: str) -> Skill:
    if skill_path not in _SKILLS:
        raise KeyError(f"Unknown skill: {skill_path}")
    return _SKILLS[skill_path]
