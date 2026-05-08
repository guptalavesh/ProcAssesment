from __future__ import annotations
import io, os, sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["setup"])

# ── 13 procurement dimensions with 52 questionnaire sub-questions ────────────
QRE_DIMENSIONS = [
    {"id": "D1",  "name": "Strategy & Governance",        "weight": 0.10},
    {"id": "D2",  "name": "Spend Visibility & Analytics", "weight": 0.08},
    {"id": "D3",  "name": "Category Management",          "weight": 0.10},
    {"id": "D4",  "name": "Sourcing & Contracting",       "weight": 0.10},
    {"id": "D5",  "name": "Supplier Management",          "weight": 0.08},
    {"id": "D6",  "name": "Operational Procurement",      "weight": 0.10},
    {"id": "D7",  "name": "Purchase-to-Pay Process",      "weight": 0.08},
    {"id": "D8",  "name": "Risk & Compliance",            "weight": 0.08},
    {"id": "D9",  "name": "Digital & Technology",         "weight": 0.08},
    {"id": "D10", "name": "People & Organisation",        "weight": 0.08},
    {"id": "D11", "name": "Sustainability",               "weight": 0.06},
    {"id": "D12", "name": "Value Delivery",               "weight": 0.08},
    {"id": "D13", "name": "Innovation",                   "weight": 0.06},
]

# ── Standard SAP column aliases ───────────────────────────────────────────────
PO_COLUMNS = {
    "po_number":        ["PO_Number","Purchase_Order","Doc_No","PO No","Purchasing Document"],
    "po_date":          ["PO_Creation_Date","PO_Date","Document_Date","Posting_Date"],
    "vendor":           ["Vendor","Vendor_Code","Supplier","Supplier_Code","Vendor No"],
    "vendor_name":      ["Vendor_Name","Supplier_Name","Name_1"],
    "material_number":  ["Material_Number","Material","Item_No","Part_No"],
    "short_text":       ["Short_Text","Material_Description","Item_Text","Description"],
    "quantity":         ["Quantity","Order_Quantity","PO_Qty"],
    "net_value":        ["Net_Value","PO_Value","Total_Value","Order_Value","Net_Amount"],
    "net_price":        ["Net_Price","Unit_Price","Price_Per_Unit"],
    "plant":            ["Plant","Plant_Code"],
    "purchase_group":   ["Purchase_Group","Purchasing_Group","Purch_Group","PGr"],
    "material_group":   ["Material_Group","Material_Grp","MatGrp","Mat_Group"],
    "material_group_desc": ["Material_Group_Desc","MatGrp_Desc","Material_Group_Description"],
    "outline_agreement":["Outline_Agreement","Framework_Order","Value_Contract"],
    "contract_number":  ["Contract_Number","Contract_No","Agmt_No"],
    "gr_date":          ["GR_Date","Goods_Receipt_Date","Entry_Date","MIGO_Date"],
    "pr_delivery_date": ["Delivery_Date","Sched_Del_Date","Requested_Delivery_Date"],
    "pr_reference":     ["PR_Reference","PR_Ref","Requisition_No","Purch_Req"],
    "po_type":          ["Document_Type","Order_Type","PO_Type"],
    "cost_center":      ["Cost_Center","WBS_Element","Account_Assignment"],
    "gl_account":       ["GL_Account","G_L_Account","Account"],
}

PR_COLUMNS = {
    "pr_number":        ["PR_Number","PR_No","Purchase_Requisition","Requisition_No"],
    "pr_date":          ["PR_Creation_Date","PR_Date","Requisition_Date","Created_On"],
    "pr_release_date":  ["PR_Release_Date","Release_Date","Approval_Date"],
    "pr_creator":       ["PR_Creator","Created_By","Requestor"],
    "pr_item":          ["PR_Item","Item","Line_Item"],
    "material_number":  ["Material_Number","Material"],
    "quantity":         ["Quantity","PR_Qty"],
    "plant":            ["Plant"],
    "purchase_group":   ["Purchase_Group","Purchasing_Group"],
    "material_group":   ["Material_Group"],
    "short_text":       ["Short_Text","Material_Description"],
    "cost_center":      ["Cost_Center","Account_Assignment"],
    "vendor_pref":      ["Preferred_Vendor","Fixed_Vendor","Source"],
}

INVOICE_COLUMNS = {
    "invoice_number":   ["Invoice_Number","Invoice_No","Document_Number"],
    "invoice_date":     ["Invoice_Date","Posting_Date"],
    "vendor":           ["Vendor","Vendor_Code"],
    "po_reference":     ["PO_Reference","Purchase_Order","Reference_Doc"],
    "net_amount":       ["Net_Amount","Invoice_Amount","Total"],
    "payment_date":     ["Payment_Date","Clearing_Date"],
    "due_date":         ["Due_Date","Baseline_Date"],
    "payment_terms":    ["Payment_Terms","Terms_of_Payment"],
    "status":           ["Status","Invoice_Status","Posting_Status"],
}

SOURCING_TOOL_COLUMNS = {
    "po_number":        ["PO_Number","PO"],
    "sourcing_tool":    ["Sourcing_Tool","Tool","Platform","Source"],
    "event_type":       ["Event_Type","Sourcing_Event","Type"],
}

EMPLOYEE_MASTER_COLUMNS = {
    "employee_id":      ["Employee_ID","Emp_ID","Personnel_No"],
    "name":             ["Name","Employee_Name","Full_Name"],
    "role":             ["Role","Job_Title","Designation"],
    "department":       ["Department","Dept","Function"],
    "location":         ["Location","Plant","Site"],
}


# ── Discovery QRE ─────────────────────────────────────────────────────────────
DISCOVERY_QRE = [
    {
        "area": "Procurement Organisation",
        "questions": [
            {"id": "ORG1", "text": "How is your procurement team structured (centralised/decentralised/hybrid)?"},
            {"id": "ORG2", "text": "How many procurement FTEs do you have, and how are they distributed?"},
            {"id": "ORG3", "text": "What is the current reporting structure for the CPO/Head of Procurement?"},
        ],
    },
    {
        "area": "Current Systems & Tools",
        "questions": [
            {"id": "SYS1", "text": "Which ERP system do you use (SAP version, modules enabled)?"},
            {"id": "SYS2", "text": "Do you use any sourcing or contract management platforms (Ariba, Coupa, etc.)?"},
            {"id": "SYS3", "text": "How do you manage supplier relationships and performance reviews?"},
        ],
    },
    {
        "area": "Procurement Process",
        "questions": [
            {"id": "PROC1", "text": "What is your typical PR-to-PO cycle time, and what are the main bottlenecks?"},
            {"id": "PROC2", "text": "What percentage of spend is covered by rate contracts or framework agreements?"},
            {"id": "PROC3", "text": "How do you handle emergency or urgent procurement requests?"},
        ],
    },
    {
        "area": "Challenges & Priorities",
        "questions": [
            {"id": "CHAL1", "text": "What are the top 3 procurement challenges your organisation faces today?"},
            {"id": "CHAL2", "text": "What does a successful transformation look like in 12-18 months?"},
            {"id": "CHAL3", "text": "Are there any upcoming business changes that will impact procurement (M&A, expansion, new categories)?"},
        ],
    },
]


class SetupPayload(BaseModel):
    client_name: str
    industry: str = ""
    assessment_type: str = "Baseline"
    date: str = ""
    assessor_name: str = ""
    notes: str = ""
    skill_path: str
    fte_count: Optional[float] = None
    annual_spend: Optional[float] = None
    annual_revenue: Optional[float] = None


@router.get("/skills")
def list_skills():
    """List available assessment skills from v1 engine."""
    try:
        from engine.skill_loader import list_skills as _list
        skills = _list()
        return [
            {
                "path":            s.path,
                "display_name":    s.display_name,
                "function_name":   s.function_name,
                "dimension_count": len(s.dimensions),
                "schema_version":  getattr(s, "schema_version", "1.0"),
                "is_procurement":  "procurement" in s.function_name.lower(),
            }
            for s in skills
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/skills/questionnaire")
def get_questionnaire(skill_path: str):
    """Return questionnaire blocks for all dimensions in a skill."""
    try:
        from engine.skill_loader import load_skill
        skill = load_skill(skill_path)
        raw = getattr(skill, "raw_yaml", None) or {}
        qbank = raw.get("questionnaire") or {}

        blocks = []
        for dim_id, dim_cfg in skill.dimensions.items():
            block = qbank.get(dim_id) or {}
            questions = []
            for q in (block.get("questions") or []):
                questions.append({
                    "code":      q.get("code", ""),
                    "text":      q.get("text", ""),
                    "mandatory": q.get("mandatory", False),
                    "options":   q.get("options") or [
                        {"score": 1, "label": "Foundation — not in place"},
                        {"score": 2, "label": "Intermediate — partially in place"},
                        {"score": 3, "label": "Advanced — mostly in place"},
                        {"score": 4, "label": "Leading — fully deployed"},
                    ],
                })
            weight_pct = int(dim_cfg.weight * 100 + 0.5)  # banker's rounding fix
            blocks.append({
                "dim_id":   dim_id,
                "title":    block.get("title") or dim_cfg.name,
                "guidance": block.get("guidance") or "",
                "weight":   weight_pct,
                "questions": questions,
            })
        return {"blocks": blocks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QuestionnaireDetailPayload(BaseModel):
    detail: Dict[str, Dict[str, int]]  # {dim_id: {question_code: score}}


@router.post("/session/{session_id}/questionnaire-detail")
def save_questionnaire_detail(session_id: str, payload: QuestionnaireDetailPayload):
    sess = get_session(session_id)
    existing = sess.get("questionnaire_detail") or {}
    # Merge new answers (don't wipe unanswered dims)
    for dim_id, answers in payload.detail.items():
        existing.setdefault(dim_id, {}).update(answers)
    sess["questionnaire_detail"] = existing
    return {"ok": True, "saved_dims": len(existing)}


@router.post("/session/{session_id}/setup")
def setup_session(session_id: str, payload: SetupPayload):
    try:
        from engine.skill_loader import load_skill
        skill = load_skill(payload.skill_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot load skill: {e}")

    sess = get_session(session_id)
    sess["skill_config"] = skill
    sess["engagement"] = {
        "client_name":    payload.client_name,
        "industry":       payload.industry,
        "assessment_type": payload.assessment_type,
        "date":           payload.date,
        "assessor_name":  payload.assessor_name,
        "notes":          payload.notes,
        "fte_count":      payload.fte_count,
        "annual_spend":   payload.annual_spend,
        "annual_revenue": payload.annual_revenue,
        "skill_path":     payload.skill_path,
    }
    return {"ok": True, "skill": skill.display_name, "dimensions": len(skill.dimensions)}


@router.get("/templates/qre")
def download_qre_template():
    """Generate the Client Data Pack (9-sheet Excel)."""
    output = io.BytesIO()
    try:
        from openpyxl import Workbook
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        wb = Workbook()

        # Brand colors
        PURPLE_FILL = PatternFill("solid", fgColor="A100FF")
        DARK_FILL   = PatternFill("solid", fgColor="460073")
        HEADER_FILL = PatternFill("solid", fgColor="F3F0F8")
        WHITE_FONT  = Font(color="FFFFFF", bold=True, size=11)
        DARK_FONT   = Font(color="460073", bold=True, size=11)

        # Sheet 1: Instructions
        ws = wb.active
        ws.title = "Instructions"
        ws["A1"] = "Procurement Maturity Assessment"
        ws["A1"].font = Font(color="460073", bold=True, size=16)
        ws["A2"] = "Client Data Pack v2.0"
        ws["A3"] = "Complete the highlighted sheets and return to your assessment team."
        ws["A5"] = "Sheets in this workbook:"
        for i, name in enumerate(["QRE", "PO Data", "PR Data", "Invoice Data",
                                   "Sourcing Tool", "Employee Master", "Documents"], 1):
            ws[f"A{5+i}"] = f"  {i}. {name}"

        # Sheet 2: QRE (52 questions)
        ws_qre = wb.create_sheet("QRE")
        headers = ["Dimension", "Question Code", "Question", "Score (1-4)", "Comments"]
        for col, h in enumerate(headers, 1):
            cell = ws_qre.cell(row=1, column=col, value=h)
            cell.fill = PURPLE_FILL
            cell.font = WHITE_FONT
        qre_rows = [
            ("D1 - Strategy & Governance", "D1Q1", "Does your organisation have a documented procurement strategy?"),
            ("D1 - Strategy & Governance", "D1Q2", "Are procurement KPIs formally tracked and reported to leadership?"),
            ("D1 - Strategy & Governance", "D1Q3", "Is there a formal procurement governance framework?"),
            ("D1 - Strategy & Governance", "D1Q4", "Are procurement policies reviewed and updated regularly?"),
            ("D2 - Spend Visibility", "D2Q1", "Do you have a spend cube or spend analytics capability?"),
            ("D2 - Spend Visibility", "D2Q2", "Can you segment spend by category, supplier, and business unit?"),
            ("D2 - Spend Visibility", "D2Q3", "Is spend data refreshed at least monthly?"),
            ("D2 - Spend Visibility", "D2Q4", "Do you have visibility into tail spend and maverick spend?"),
            ("D3 - Category Management", "D3Q1", "Are category strategies documented for top spend categories?"),
            ("D3 - Category Management", "D3Q2", "Are category managers assigned to major spend categories?"),
            ("D3 - Category Management", "D3Q3", "Are category strategies reviewed and updated annually?"),
            ("D3 - Category Management", "D3Q4", "Is market intelligence actively used in category planning?"),
            ("D4 - Sourcing & Contracting", "D4Q1", "Are competitive tendering processes followed for strategic purchases?"),
            ("D4 - Sourcing & Contracting", "D4Q2", "Is there a contract management system in use?"),
            ("D4 - Sourcing & Contracting", "D4Q3", "Are contract expiry dates tracked and renewals proactively managed?"),
            ("D4 - Sourcing & Contracting", "D4Q4", "Are savings targets set and tracked for sourcing events?"),
            ("D5 - Supplier Management", "D5Q1", "Are strategic suppliers formally segmented and tiered?"),
            ("D5 - Supplier Management", "D5Q2", "Are supplier performance reviews conducted at least quarterly?"),
            ("D5 - Supplier Management", "D5Q3", "Are supplier scorecards used with defined KPIs?"),
            ("D5 - Supplier Management", "D5Q4", "Is there a formal supplier development programme?"),
            ("D6 - Operational Procurement", "D6Q1", "Are purchase requisitions routed through an automated approval workflow?"),
            ("D6 - Operational Procurement", "D6Q2", "Is there a purchase order management process with SLAs?"),
            ("D6 - Operational Procurement", "D6Q3", "Are blanket orders or call-off orders used for recurring spend?"),
            ("D6 - Operational Procurement", "D6Q4", "Is there a catalog/punch-out capability for standard items?"),
            ("D7 - Purchase-to-Pay", "D7Q1", "Is invoice matching (2-way or 3-way) automated?"),
            ("D7 - Purchase-to-Pay", "D7Q2", "Are payment terms standardised across the supplier base?"),
            ("D7 - Purchase-to-Pay", "D7Q3", "Are early payment discounts actively captured?"),
            ("D7 - Purchase-to-Pay", "D7Q4", "Is the exception rate in invoice processing tracked?"),
            ("D8 - Risk & Compliance", "D8Q1", "Is there a formal supplier risk assessment process?"),
            ("D8 - Risk & Compliance", "D8Q2", "Are single-source dependencies tracked and mitigated?"),
            ("D8 - Risk & Compliance", "D8Q3", "Is procurement compliant with company's code of conduct and ESG policies?"),
            ("D8 - Risk & Compliance", "D8Q4", "Is there a business continuity plan for critical supply items?"),
            ("D9 - Digital & Technology", "D9Q1", "Is an e-sourcing platform used for competitive events?"),
            ("D9 - Digital & Technology", "D9Q2", "Is spend analytics software deployed and actively used?"),
            ("D9 - Digital & Technology", "D9Q3", "Are AI/ML tools being piloted or deployed in procurement?"),
            ("D9 - Digital & Technology", "D9Q4", "Is procurement integrated with ERP for real-time data?"),
            ("D10 - People & Organisation", "D10Q1", "Are procurement staff competencies formally assessed?"),
            ("D10 - People & Organisation", "D10Q2", "Is there a structured learning and development programme?"),
            ("D10 - People & Organisation", "D10Q3", "Is there a clear career path for procurement professionals?"),
            ("D10 - People & Organisation", "D10Q4", "Is change management capability embedded in the team?"),
            ("D11 - Sustainability", "D11Q1", "Are ESG criteria included in supplier qualification?"),
            ("D11 - Sustainability", "D11Q2", "Is Scope 3 supply chain emissions tracked?"),
            ("D11 - Sustainability", "D11Q3", "Are sustainable/responsible sourcing targets set?"),
            ("D11 - Sustainability", "D11Q4", "Are suppliers assessed on ESG performance?"),
            ("D12 - Value Delivery", "D12Q1", "Are procurement savings formally tracked and reported to finance?"),
            ("D12 - Value Delivery", "D12Q2", "Is total cost of ownership (TCO) used in sourcing decisions?"),
            ("D12 - Value Delivery", "D12Q3", "Are demand management and specification optimisation practiced?"),
            ("D12 - Value Delivery", "D12Q4", "Is working capital impact of procurement decisions tracked?"),
            ("D13 - Innovation", "D13Q1", "Are suppliers involved in product/process innovation programmes?"),
            ("D13 - Innovation", "D13Q2", "Is there a supplier innovation portal or programme?"),
            ("D13 - Innovation", "D13Q3", "Are innovation metrics tracked for key suppliers?"),
            ("D13 - Innovation", "D13Q4", "Is procurement contributing to R&D or new product introduction?"),
        ]
        for row_num, (dim, code, question) in enumerate(qre_rows, 2):
            ws_qre.cell(row=row_num, column=1, value=dim)
            ws_qre.cell(row=row_num, column=2, value=code)
            ws_qre.cell(row=row_num, column=3, value=question)
            ws_qre.cell(row=row_num, column=4, value="")  # Score to be filled
            ws_qre.cell(row=row_num, column=5, value="")  # Comments

        # Sheet 3: PO Data
        ws_po = wb.create_sheet("PO Data")
        po_headers = ["PO_Number","PO_Creation_Date","Vendor","Vendor_Name","Material_Number",
                      "Short_Text","Quantity","Net_Value","Net_Price","Plant","Purchase_Group",
                      "Material_Group","Material_Group_Desc","Outline_Agreement","Contract_Number",
                      "GR_Date","Delivery_Date","PR_Reference","Document_Type"]
        for col, h in enumerate(po_headers, 1):
            cell = ws_po.cell(row=1, column=col, value=h)
            cell.fill = DARK_FILL
            cell.font = WHITE_FONT

        # Sheet 4: PR Data
        ws_pr = wb.create_sheet("PR Data")
        pr_headers = ["PR_Number","PR_Creation_Date","PR_Release_Date","PR_Creator",
                      "Material_Number","Short_Text","Quantity","Plant","Purchase_Group",
                      "Material_Group","Cost_Center","Preferred_Vendor"]
        for col, h in enumerate(pr_headers, 1):
            cell = ws_pr.cell(row=1, column=col, value=h)
            cell.fill = DARK_FILL
            cell.font = WHITE_FONT

        # Additional sheets (Invoice, Sourcing, Employee, Documents)
        for sheet_name, headers in [
            ("Invoice Data", ["Invoice_Number","Invoice_Date","Vendor","PO_Reference",
                              "Net_Amount","Payment_Date","Due_Date","Payment_Terms","Status"]),
            ("Sourcing Tool", ["PO_Number","Sourcing_Tool","Event_Type"]),
            ("Employee Master", ["Employee_ID","Name","Role","Department","Location"]),
            ("Documents Checklist", ["Document","Status","Comments","Date_Submitted"]),
        ]:
            ws_s = wb.create_sheet(sheet_name)
            for col, h in enumerate(headers, 1):
                cell = ws_s.cell(row=1, column=col, value=h)
                cell.fill = HEADER_FILL
                cell.font = DARK_FONT

        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="AIVault_Client_Data_Pack.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/synthetic")
def download_synthetic_data():
    """Generate 25 synthetic PO + 25 PR rows for testing."""
    import random
    from datetime import datetime, timedelta

    output = io.BytesIO()
    try:
        from openpyxl import Workbook
        wb = Workbook()

        # PO sheet
        ws_po = wb.active
        ws_po.title = "PO Data"
        po_headers = ["PO_Number","PO_Creation_Date","Vendor","Vendor_Name","Material_Number",
                      "Short_Text","Quantity","Net_Value","Net_Price","Plant","Purchase_Group",
                      "Material_Group","Outline_Agreement","Contract_Number","GR_Date",
                      "Delivery_Date","PR_Reference","Document_Type"]
        ws_po.append(po_headers)

        vendors = [("V001","Tata Steel Supplies"),("V002","Ambuja Cements Ltd"),
                   ("V003","L&T Engineering"),("V004","JSW Industrial"),("V005","Reliance Supply")]
        materials = [("M001","Bearing Assembly"),("M002","Hydraulic Fluid"),
                     ("M003","Safety Helmets"),("M004","Welding Electrodes"),("M005","Conveyor Belt")]
        plants = ["PL01","PL02","PL03"]
        pgs = ["PG10","PG20","PG30"]
        mgs = ["MG001","MG002","MG003","MG004","MG005"]
        base_date = datetime(2023, 1, 1)

        for i in range(1, 26):
            v_code, v_name = random.choice(vendors)
            m_code, m_desc = random.choice(materials)
            po_date = base_date + timedelta(days=random.randint(0, 365))
            gr_date = po_date + timedelta(days=random.randint(5, 45))
            pr_date = po_date - timedelta(days=random.randint(5, 30))
            qty = random.randint(1, 100)
            price = round(random.uniform(1000, 500000), 2)
            rc = f"RC{random.randint(1000,9999)}" if random.random() > 0.4 else ""
            ws_po.append([
                f"PO{4500000+i}", po_date.strftime("%Y-%m-%d"),
                v_code, v_name, m_code, m_desc,
                qty, qty * price, price,
                random.choice(plants), random.choice(pgs),
                random.choice(mgs), rc, rc,
                gr_date.strftime("%Y-%m-%d"),
                (po_date + timedelta(days=random.randint(10, 30))).strftime("%Y-%m-%d"),
                f"PR{1000000+i}", "NB",
            ])

        # PR sheet
        ws_pr = wb.create_sheet("PR Data")
        ws_pr.append(["PR_Number","PR_Creation_Date","PR_Release_Date","PR_Creator",
                      "Material_Number","Short_Text","Quantity","Plant",
                      "Purchase_Group","Material_Group","Cost_Center"])
        for i in range(1, 26):
            m_code, m_desc = random.choice(materials)
            pr_date = base_date + timedelta(days=random.randint(0, 365))
            release_date = pr_date + timedelta(days=random.randint(1, 5))
            ws_pr.append([
                f"PR{1000000+i}", pr_date.strftime("%Y-%m-%d"),
                release_date.strftime("%Y-%m-%d"),
                f"USER{random.randint(100,999)}",
                m_code, m_desc, random.randint(1, 50),
                random.choice(plants), random.choice(pgs),
                random.choice(mgs), f"CC{random.randint(1000,9999)}",
            ])

        wb.save(output)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="AIVault_Synthetic_Test_Data.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/discovery-qre/questions")
def get_discovery_questions():
    return {"areas": DISCOVERY_QRE}


@router.post("/session/{session_id}/discovery-qre")
def save_discovery_qre(session_id: str, payload: dict):
    sess = get_session(session_id)
    sess["discovery_qre"] = payload.get("answers", {})
    return {"ok": True}


@router.get("/session/{session_id}/discovery-qre")
def get_discovery_qre(session_id: str):
    sess = get_session(session_id)
    return {"answers": sess.get("discovery_qre") or {}}
