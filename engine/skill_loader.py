from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class Dimension:
    id: str
    name: str
    weight: float


@dataclass
class Skill:
    path: str
    display_name: str
    function_name: str
    dimensions: Dict[str, Dimension]
    schema_version: str = "1.0"
    raw_yaml: Dict[str, Any] = field(default_factory=dict)


_DIMENSIONS: List[Dimension] = [
    Dimension("D1",  "Strategy & Governance",        0.10),
    Dimension("D2",  "Spend Visibility & Analytics", 0.08),
    Dimension("D3",  "Category Management",          0.10),
    Dimension("D4",  "Sourcing & Contracting",       0.10),
    Dimension("D5",  "Supplier Management",          0.08),
    Dimension("D6",  "Operational Procurement",      0.10),
    Dimension("D7",  "Purchase-to-Pay Process",      0.08),
    Dimension("D8",  "Risk & Compliance",            0.08),
    Dimension("D9",  "Digital & Technology",         0.08),
    Dimension("D10", "People & Organisation",        0.08),
    Dimension("D11", "Sustainability",               0.06),
    Dimension("D12", "Value Delivery",               0.08),
    Dimension("D13", "Innovation",                   0.06),
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
