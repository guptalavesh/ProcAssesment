# REBUILD GUIDE — Part 2: All Backend Routers (Complete Source)

---

## 1. backend/routers/setup.py

This is the largest router (~1200 lines). Key sections:

```python
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
    """Generate the Accenture Client Data Pack (9-sheet Excel)."""
    # (Full implementation creates Excel with 9 sheets:
    # Instructions, QRE, PO Data, PR Data, Invoice Data, Sourcing Tool,
    # Employee Master, Documents Checklist, Capability Assessment)
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
        ws["A1"] = "Accenture Procurement Maturity Assessment"
        ws["A1"].font = Font(color="460073", bold=True, size=16)
        ws["A2"] = "Client Data Pack v2.0"
        ws["A3"] = "Complete the highlighted sheets and return to your Accenture engagement team."
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
            headers={"Content-Disposition": 'attachment; filename="Accenture_Assessment_Client_Pack.xlsx"'},
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
            headers={"Content-Disposition": 'attachment; filename="Accenture_Assessment_Synthetic_Test_Data.xlsx"'},
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
```

---

## 2. backend/routers/upload.py

```python
from __future__ import annotations
import io
from typing import Optional
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["upload"])


def _maybe_pick_sheet(data_bytes, filename, sheet):
    """If xlsx and a sheet is specified, extract that sheet into fresh xlsx bytes."""
    if not data_bytes or not sheet or not filename:
        return data_bytes
    if not filename.lower().endswith((".xlsx", ".xls")):
        return data_bytes
    try:
        bio = io.BytesIO(data_bytes)
        xl = pd.ExcelFile(bio)
        if sheet not in xl.sheet_names:
            return data_bytes
        df = xl.parse(sheet)
        out = io.BytesIO()
        df.to_excel(out, index=False, sheet_name=sheet[:31] or "Sheet1")
        return out.getvalue()
    except Exception:
        return data_bytes


@router.post("/session/{session_id}/upload")
async def upload_files(
    session_id: str,
    po_file:             Optional[UploadFile] = File(None),
    pr_file:             Optional[UploadFile] = File(None),
    qre_file:            Optional[UploadFile] = File(None),
    invoice_file:        Optional[UploadFile] = File(None),
    workforce_file:      Optional[UploadFile] = File(None),
    quality_file:        Optional[UploadFile] = File(None),
    inventory_file:      Optional[UploadFile] = File(None),
    goods_movement_file: Optional[UploadFile] = File(None),
    po_gr_file:          Optional[UploadFile] = File(None),
    production_file:     Optional[UploadFile] = File(None),
    maintenance_file:    Optional[UploadFile] = File(None),
    pdf_file:            Optional[UploadFile] = File(None),
    po_sheet:             Optional[str] = Form(None),
    pr_sheet:             Optional[str] = Form(None),
    qre_sheet:            Optional[str] = Form(None),
    invoice_sheet:        Optional[str] = Form(None),
    workforce_sheet:      Optional[str] = Form(None),
    quality_sheet:        Optional[str] = Form(None),
    inventory_sheet:      Optional[str] = Form(None),
    goods_movement_sheet: Optional[str] = Form(None),
    po_gr_sheet:          Optional[str] = Form(None),
    production_sheet:     Optional[str] = Form(None),
    maintenance_sheet:    Optional[str] = Form(None),
):
    from engine.data_loader import (
        DataLoadError,
        load_po_dump, load_pr_dump, load_qre, load_invoice,
        load_workforce, load_inventory, load_goods_movement,
        load_po_gr, load_production, load_maintenance,
    )
    from engine.column_resolver import resolve_for_skill
    from engine.metrics import get_coverage_preview

    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")

    async def _read(upload):
        if upload is None: return None
        data = await upload.read()
        return data if data else None

    po_bytes         = _maybe_pick_sheet(await _read(po_file),     po_file.filename if po_file else None, po_sheet)
    pr_bytes         = _maybe_pick_sheet(await _read(pr_file),     pr_file.filename if pr_file else None, pr_sheet)
    qre_bytes        = _maybe_pick_sheet(await _read(qre_file),    qre_file.filename if qre_file else None, qre_sheet)
    invoice_bytes    = _maybe_pick_sheet(await _read(invoice_file), invoice_file.filename if invoice_file else None, invoice_sheet)
    workforce_bytes  = _maybe_pick_sheet(await _read(workforce_file), workforce_file.filename if workforce_file else None, workforce_sheet)
    quality_bytes    = await _read(quality_file)
    inventory_bytes  = _maybe_pick_sheet(await _read(inventory_file), inventory_file.filename if inventory_file else None, inventory_sheet)
    gm_bytes         = _maybe_pick_sheet(await _read(goods_movement_file), goods_movement_file.filename if goods_movement_file else None, goods_movement_sheet)
    po_gr_bytes      = _maybe_pick_sheet(await _read(po_gr_file),  po_gr_file.filename if po_gr_file else None, po_gr_sheet)
    production_bytes = _maybe_pick_sheet(await _read(production_file), production_file.filename if production_file else None, production_sheet)
    maintenance_bytes = _maybe_pick_sheet(await _read(maintenance_file), maintenance_file.filename if maintenance_file else None, maintenance_sheet)
    pdf_bytes        = await _read(pdf_file)

    file_results = {}
    dfs = sess["dataframes"]

    def _load(name, loader, data_bytes):
        if not data_bytes: return None
        bio = io.BytesIO(data_bytes)
        try:
            df = loader(bio)
            dfs[name] = df
            return {"rows": len(df), "columns": len(df.columns), "ok": True}
        except DataLoadError as e:
            return {"rows": 0, "columns": 0, "ok": False, "error": str(e)}
        except Exception as e:
            return {"rows": 0, "columns": 0, "ok": False, "error": str(e)}

    file_results["po"]             = _load("po_df",             load_po_dump,        po_bytes)
    file_results["pr"]             = _load("pr_df",             load_pr_dump,        pr_bytes)
    file_results["qre"]            = _load("qre_df",            load_qre,            qre_bytes)
    file_results["invoice"]        = _load("invoice_df",        load_invoice,        invoice_bytes)
    file_results["workforce"]      = _load("workforce_df",      load_workforce,      workforce_bytes)
    file_results["inventory"]      = _load("inventory_df",      load_inventory,      inventory_bytes)
    file_results["goods_movement"] = _load("goods_movement_df", load_goods_movement, gm_bytes)
    file_results["po_gr"]          = _load("po_gr_df",          load_po_gr,          po_gr_bytes)
    file_results["production"]     = _load("production_df",     load_production,     production_bytes)
    file_results["maintenance"]    = _load("maintenance_df",    load_maintenance,    maintenance_bytes)

    if quality_bytes:
        try:
            bio = io.BytesIO(quality_bytes)
            fname = quality_file.filename or ""
            df = pd.read_excel(bio) if fname.endswith((".xlsx",".xls")) else pd.read_csv(bio)
            dfs["quality_df"] = df
            file_results["quality"] = {"rows": len(df), "columns": len(df.columns), "ok": True}
        except Exception as e:
            file_results["quality"] = {"rows": 0, "columns": 0, "ok": False, "error": str(e)}

    if pdf_bytes:
        sess["pdf_bytes"] = pdf_bytes
        sess["pdf_filename"] = pdf_file.filename if pdf_file else ""

    # Column resolution
    needs_review = False
    col_resolution = None
    try:
        def _df_cols(key):
            df = dfs.get(key)
            return list(df.columns) if df is not None else None

        col_resolution = resolve_for_skill(
            skill_column_aliases=skill.column_aliases,
            po_columns=_df_cols("po_df") or [],
            pr_columns=_df_cols("pr_df"),
            invoice_columns=_df_cols("invoice_df"),
            workforce_columns=_df_cols("workforce_df"),
            inventory_columns=_df_cols("inventory_df"),
            goods_movement_columns=_df_cols("goods_movement_df"),
            po_gr_columns=_df_cols("po_gr_df"),
            production_columns=_df_cols("production_df"),
            maintenance_columns=_df_cols("maintenance_df"),
        )

        # Source-separation fix: PR-owned logical names must resolve to PR df columns
        if dfs.get("pr_df") is not None and col_resolution is not None:
            from engine.column_resolver import resolve_columns as _rc_single
            po_col_set = set(_df_cols("po_df") or [])
            pr_col_set = set(_df_cols("pr_df") or [])
            PR_OWNED = {"pr_date","pr_number","pr_release_date","pr_creator","pr_creation_date"}
            for logical in PR_OWNED:
                bad_col = col_resolution.resolved.get(logical)
                if bad_col and bad_col in po_col_set and bad_col not in pr_col_set:
                    pr_only = _rc_single([logical], list(pr_col_set))
                    if pr_only.resolved.get(logical):
                        col_resolution.resolved[logical] = pr_only.resolved[logical]
                    elif pr_only.suggestions.get(logical):
                        col_resolution.resolved.pop(logical, None)
                        col_resolution.suggestions[logical] = pr_only.suggestions[logical]
                    else:
                        col_resolution.resolved.pop(logical, None)
                        if logical not in col_resolution.unmatched:
                            col_resolution.unmatched.append(logical)

        sess["col_resolution"] = col_resolution
        sess["final_col_map"] = dict(col_resolution.resolved)
        needs_review = col_resolution.needs_user_review()
    except Exception as e:
        import traceback; traceback.print_exc()

    # Coverage preview
    coverage = {}
    try:
        col_map_for_coverage = col_resolution.resolved if col_resolution else {}
        available_sources = [k for k, v in dfs.items() if v is not None]
        coverage = get_coverage_preview(skill, col_map_for_coverage, available_sources)
    except Exception as e:
        print(f"[coverage_preview] WARNING: {e}")

    next_screen = "column_review" if needs_review else "configure"
    return {
        "files": file_results,
        "coverage": coverage,
        "next_screen": next_screen,
        "needs_column_review": needs_review,
    }


class TextQREPayload(BaseModel):
    text: str


@router.post("/session/{session_id}/parse-text-qre")
def parse_text_qre(session_id: str, payload: TextQREPayload):
    from engine.text_qre_parser import parse_free_text_qre
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    try:
        results = parse_free_text_qre(payload.text, skill)
        sess["text_qre_results"] = results
        return {"results": [
            {"dim_id": r.dim_id, "dim_name": r.dim_name, "score": r.score,
             "confidence": r.confidence, "confidence_label": r.confidence_label,
             "evidence": r.evidence}
            for r in results.values()
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TextQREConfirmPayload(BaseModel):
    confirmed: dict  # {dim_id: score_int}


@router.post("/session/{session_id}/confirm-text-qre")
def confirm_text_qre(session_id: str, payload: TextQREConfirmPayload):
    sess = get_session(session_id)
    sess["text_qre_confirmed"] = {k: int(v) for k, v in payload.confirmed.items()}
    # Re-aggregate scores immediately so UI shows updated score without re-run
    dim_results = sess.get("dim_results") or []
    overall_result = sess.get("overall_result")
    kpi_assessment = sess.get("kpi_assessment")
    confirmed = sess["text_qre_confirmed"]
    if dim_results and overall_result and confirmed:
        def _g(o, k, default=None):
            return getattr(o, k, default) if hasattr(o, k) else (o.get(k, default) if isinstance(o, dict) else default)
        for dr in dim_results:
            dim_id = _g(dr, "dim_id")
            if dim_id and dim_id in confirmed:
                new_score = int(confirmed[dim_id])
                if hasattr(dr, "score"): dr.score = new_score; dr.data_source = "qre"
                elif isinstance(dr, dict): dr["score"] = new_score; dr["data_source"] = "qre"
        scored = [dr for dr in dim_results if _g(dr, "score") is not None]
        if scored:
            total_w = sum(float(_g(dr, "weight") or 0) for dr in scored)
            weighted = sum(float(_g(dr, "score") or 0) * float(_g(dr, "weight") or 0) for dr in scored)
            if total_w > 0:
                new_dim_overall = weighted / total_w
                if hasattr(overall_result, "score"): overall_result.score = round(new_dim_overall, 2)
        if kpi_assessment is not None and confirmed:
            kpi_score = getattr(kpi_assessment, "overall_score", None)
            if kpi_score is not None:
                qre_total_w, qre_weighted = 0.0, 0.0
                for dr in dim_results:
                    dim_id = _g(dr, "dim_id")
                    if dim_id and dim_id in confirmed:
                        w = float(_g(dr, "weight") or 0)
                        qre_total_w += w; qre_weighted += float(confirmed[dim_id]) * w
                if qre_total_w > 0:
                    blended = (kpi_score * 1.0 + qre_weighted) / (1.0 + qre_total_w)
                    kpi_assessment.overall_score = round(blended, 2)
    return {"ok": True, "confirmed_count": len(payload.confirmed)}
```

---

## 3. backend/routers/column_review.py

```python
from __future__ import annotations
from typing import Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["column_review"])


@router.get("/session/{session_id}/columns")
def get_columns(session_id: str):
    sess = get_session(session_id)
    col_res = sess.get("col_resolution")
    if col_res is None:
        return {"resolved": {}, "suggestions": {}, "unmatched": [], "available_columns": [], "skill_aliases": {}}
    skill = sess["skill_config"]
    skill_aliases = skill.column_aliases if skill else {}
    available_cols = set()
    for df in sess["dataframes"].values():
        if df is not None: available_cols.update(df.columns.tolist())
    suggestions = {}
    for logical, (suggested, confidence) in (col_res.suggestions or {}).items():
        suggestions[logical] = {"suggested": suggested, "confidence": round(confidence, 3)}
    return {
        "resolved": col_res.resolved or {},
        "suggestions": suggestions,
        "unmatched": list(col_res.unmatched or []),
        "available_columns": sorted(available_cols),
        "skill_aliases": skill_aliases,
    }


class ColumnConfirmPayload(BaseModel):
    confirmed: Dict[str, str] = {}
    unavailable: List[str] = []


@router.post("/session/{session_id}/columns/confirm")
def confirm_columns(session_id: str, payload: ColumnConfirmPayload):
    from engine.column_resolver import apply_user_decisions, save_column_map
    sess = get_session(session_id)
    col_res = sess.get("col_resolution")
    if col_res is None:
        raise HTTPException(status_code=400, detail="No column resolution to confirm.")
    final_map = dict(col_res.resolved or {})
    final_map.update(payload.confirmed)
    for logical in payload.unavailable:
        final_map.pop(logical, None)
    sess["confirmed_cols"] = dict(payload.confirmed)
    sess["unavailable_cols"] = list(payload.unavailable)
    sess["final_col_map"] = final_map
    client_name = sess.get("engagement", {}).get("client_name", "")
    skill = sess.get("skill_config")
    if client_name and skill:
        try: save_column_map(client_name, skill.function_name, final_map)
        except Exception: pass
    return {"ok": True, "final_map": final_map}
```

---

## 4. backend/routers/configure.py

```python
from __future__ import annotations
from typing import Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from session_store import get_session

router = APIRouter(tags=["configure"])


@router.get("/session/{session_id}/configure")
def get_configure(session_id: str):
    from engine.kpi_engine import KPI_META, BUCKETS, BUCKET_ICONS
    from engine.benchmark_loader import load_benchmarks, get_benchmark_display
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    is_procurement = "procurement" in skill.function_name.lower()
    engagement = sess.get("engagement", {})
    industry = engagement.get("industry", "")
    dimensions = []
    for dim_id, dim_cfg in skill.dimensions.items():
        dimensions.append({
            "dim_id": dim_id, "name": dim_cfg.name,
            "weight": round(dim_cfg.weight * 100, 1),
            "kpi_count": len(dim_cfg.kpis),
            "default_weight": round(dim_cfg.weight * 100, 1),
        })
    result = {
        "is_procurement": is_procurement,
        "dimensions": dimensions,
        "engagement": {"fte_count": engagement.get("fte_count"),
                       "annual_spend": engagement.get("annual_spend"),
                       "industry": industry},
    }
    if is_procurement:
        benchmarks = {}
        benchmarks_display = {}
        try:
            benchmarks = load_benchmarks(industry)
            benchmarks_display = get_benchmark_display(benchmarks)
        except Exception: pass
        data_ready = {}
        dfs = sess.get("dataframes", {})
        for kid, meta in KPI_META.items():
            sources = meta.get("sources", [])
            data_ready[kid] = any(dfs.get(s) is not None for s in sources)
        saved_kpi_weights = sess.get("kpi_weight_config", {})
        result["kpi_meta"] = {
            kid: {"label": m["label"], "weight": saved_kpi_weights.get(kid, m["weight"]),
                  "direction": m["direction"], "unit": m.get("unit",""), "bucket": m["bucket"]}
            for kid, m in KPI_META.items()
        }
        result["buckets"] = BUCKETS
        result["bucket_icons"] = BUCKET_ICONS
        result["data_ready"] = data_ready
        result["benchmarks_display"] = benchmarks_display
    return result


class ConfigurePayload(BaseModel):
    weight_config: Dict[str, float] = {}
    include_dims: Dict[str, bool] = {}
    kpi_weight_config: Dict[str, float] = {}


@router.post("/session/{session_id}/configure")
def save_configure(session_id: str, payload: ConfigurePayload):
    sess = get_session(session_id)
    skill = sess.get("skill_config")
    if skill is None:
        raise HTTPException(status_code=400, detail="Run /setup first.")
    weight_config = {dim_id: float(pct)/100.0 for dim_id, pct in payload.weight_config.items()}
    include_dims = {dim_id: payload.include_dims.get(dim_id, True) for dim_id in skill.dimensions}
    sess["weight_config"] = weight_config
    sess["include_dims"] = include_dims
    if payload.kpi_weight_config:
        sess["kpi_weight_config"] = {kpi_id: float(pct)/100.0 for kpi_id, pct in payload.kpi_weight_config.items()}
    return {"ok": True}
```

---

## 5. backend/routers/run.py

See complete file in Part 1 context — includes `_run_pipeline()` (7 steps), `trigger_run`,
`run_status` (SSE), `run_status_json` (polling).

**Key run pipeline steps:**
1. `assemble_bundle()` — DataBundle from all DataFrames
2. `compute_all_kpis()` — KPI metric computation
3. PDF/qualitative analysis (optional, if pdf_bytes + llm_api_key)
4. `score_all_dimensions()` + dimension 1.0 guard
5. `compute_kpi_assessment()` + kpi_dashboard override + custom weights (procurement only)
6. `build_report()` — Excel output
7. Done

**Critical SAP fixes in run.py:**
- `_prepare_kpi_df()` — adds kpi_engine-compatible aliases from col_map
- PO date forced from `PO_Creation_Date`/`PO_Date`/`PO_Doc_Date`
- PR date columns in PO df masked to force TAT join path (not denormalised path)
- Combined "agreement" column pre-computed from Contract_Number + Outline_Agreement
- `last po price` derived via shift(1) grouped by material_number + sorted by po_date
- Dashboard override: kpi_engine actuals replaced with kpi_dashboard computed values

---

## 6. backend/routers/results.py  (first 300 lines — key endpoints)

```python
from __future__ import annotations
import math
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from serializers import (
    serialize_dimension_result, serialize_overall_result,
    serialize_kpi_assessment, serialize_insight_card, serialize_diagnostic,
)
from session_store import get_session

router = APIRouter(tags=["results"])


@router.get("/session/{session_id}/results")
def get_results(session_id: str):
    sess = get_session(session_id)
    overall = sess.get("overall_result")
    if overall is None:
        raise HTTPException(status_code=404, detail="Assessment not run yet.")
    dim_results = sess.get("dim_results", [])
    kpi_assessment = sess.get("kpi_assessment")
    overall_serialised = serialize_overall_result(overall)
    # Score reconciliation: KPI score is canonical for procurement
    if kpi_assessment is not None:
        kpi_score = getattr(kpi_assessment, "overall_score", None)
        kpi_label = getattr(kpi_assessment, "overall_label", None)
        if kpi_score is not None:
            overall_serialised["score"] = kpi_score
            overall_serialised["level"] = kpi_label or overall_serialised.get("level")
            overall_serialised["dimension_score"] = getattr(overall, "score", None)
    return {
        "engagement": sess.get("engagement", {}),
        "overall": overall_serialised,
        "dimension_results": [serialize_dimension_result(dr) for dr in dim_results],
        "kpi_assessment": serialize_kpi_assessment(kpi_assessment),
    }


@router.get("/session/{session_id}/results/organogram")
def get_organogram(session_id: str, model: str = "Centralised", fte: int = 20):
    sess = get_session(session_id)
    try:
        from engine.organogram import build_organogram_html
        html = build_organogram_html(model, fte)
        return {"html": html}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/results/swimlane")
def get_swimlane(session_id: str, kpi_gaps: str = ""):
    from pathlib import Path
    import os
    gap_list = [g.strip() for g in kpi_gaps.split(",") if g.strip()] if kpi_gaps else []
    s2p_candidates = [
        Path(os.environ.get("S2P_PROCESS_PATH", "x_not_set")),
        Path(r"C:\Users\shuja.a.haider.abidi\Accenture\Agentic Service Delivery - General\Assessment App v2\Process file\S2P_Process_L1_L5_RACI.xlsx"),
        Path(__file__).parent.parent.parent / "Process file" / "S2P_Process_L1_L5_RACI.xlsx",
    ]
    for p in s2p_candidates:
        if p and p.exists():
            try:
                html = _build_swimlane_from_s2p(p, gap_list)
                return {"html": html}
            except Exception: pass
    return {"html": "<p>Process map not available — place S2P_Process_L1_L5_RACI.xlsx in Process file/</p>"}


@router.get("/session/{session_id}/results/org-recommendation")
def get_org_recommendation(session_id: str):
    sess = get_session(session_id)
    engagement = sess.get("engagement") or {}
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    fte = engagement.get("fte_count")
    annual_spend = engagement.get("annual_spend")
    model = "Centralised"
    signals = []
    # Determine model based on signals
    plant_count = 1
    if po_df is not None:
        from routers.kpi_dashboard import _get_po_col
        plant_col = _get_po_col(po_df, "plant", col_map)
        if plant_col: plant_count = int(po_df[plant_col].nunique())
    if plant_count > 5: model = "Hybrid"; signals.append(f"{plant_count} plants — decentralised ops signal")
    else: signals.append(f"{plant_count} plant(s) — centralised model fits")
    if fte and annual_spend:
        spend_per_fte = annual_spend / fte
        if spend_per_fte < 10: model = "Centralised"; signals.append(f"₹{spend_per_fte:.0f} Cr/FTE — below benchmark, centralise")
        else: signals.append(f"₹{spend_per_fte:.0f} Cr/FTE — meets benchmark")
    fte_range = f"{max(1, int((fte or 20) * 0.8))}–{int((fte or 20) * 1.2)}" if fte else "15–25"
    return {"model": model, "signals": signals, "fte_range": fte_range}


@router.get("/session/{session_id}/results/buying-channel")
def get_buying_channel(session_id: str):
    sess = get_session(session_id)
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    if po_df is None:
        return {"rows": [], "summary": {"total_mgs": 0, "classified": 0}}
    try:
        from routers.kpi_dashboard import _get_po_col
        import pandas as pd
        mg_col  = _get_po_col(po_df, "material_group", col_map)
        nv_col  = _get_po_col(po_df, "net_value", col_map)
        rc_col  = next((c for c in ["agreement","Outline_Agreement","Contract_Number"] if c in po_df.columns), None)
        mt_col  = _get_po_col(po_df, "material_type", col_map)
        desc_col = _get_po_col(po_df, "material_group_desc", col_map)
        rows = []
        if mg_col and nv_col:
            agg = po_df.groupby(mg_col).agg(
                spend=(nv_col, lambda x: pd.to_numeric(x, errors="coerce").sum()),
                po_count=(nv_col, "count"),
            ).reset_index()
            agg["spend_cr"] = agg["spend"] / 1e7
            total_spend = agg["spend"].sum()
            agg["spend_pct"] = agg["spend"] / total_spend * 100 if total_spend > 0 else 0
            # RC coverage per MG
            if rc_col:
                rc_rate = po_df.groupby(mg_col).apply(
                    lambda g: (g[rc_col].notna() & (g[rc_col].astype(str).str.strip() != "")).mean() * 100
                ).rename("rc_rate")
                agg = agg.merge(rc_rate, on=mg_col, how="left")
            else: agg["rc_rate"] = 0
            # Description
            if desc_col:
                desc_map = po_df.groupby(mg_col)[desc_col].first().to_dict()
                agg["desc"] = agg[mg_col].map(desc_map).fillna("")
            else: agg["desc"] = ""
            # Classify archetype
            def _classify(row):
                rc = row.get("rc_rate", 0) or 0
                spend = row.get("spend_cr", 0) or 0
                if rc >= 60: ch = "Contracts"; conf = "HIGH" if rc >= 80 else "MEDIUM"
                elif spend > 50: ch = "RFQ"; conf = "MEDIUM"
                else: ch = "Open RFQ"; conf = "LOW"
                arch = "BULK" if spend > 20 else "INDIRECT" if spend > 5 else "NON-CRITICAL"
                tat_map = {"Contracts": 3, "RFQ": 25, "Open RFQ": 60}
                return ch, arch, conf, tat_map.get(ch, 45), tat_map.get("Contracts", 3)
            for _, row in agg.iterrows():
                ch, arch, conf, asis_tat, tobe_tat = _classify(row)
                rows.append({
                    "mg_code": row[mg_col], "mg_desc": row["desc"],
                    "archetype": arch, "current_channel": ch, "recommended_channel": ch,
                    "confidence": conf,
                    "spend_cr": round(float(row["spend_cr"]), 2),
                    "spend_pct": round(float(row["spend_pct"]), 2),
                    "po_count": int(row["po_count"]),
                    "asis_tat": asis_tat, "tobe_tat": tobe_tat,
                    "signal": f"RC coverage: {row.get('rc_rate',0):.0f}%",
                })
        return {"rows": sorted(rows, key=lambda r: r["spend_cr"], reverse=True),
                "summary": {"total_mgs": len(rows), "classified": sum(1 for r in rows if r["confidence"] != "LOW")}}
    except Exception as e:
        return {"rows": [], "summary": {"total_mgs": 0, "classified": 0}, "error": str(e)}


@router.get("/session/{session_id}/results/value-tree")
def get_value_tree(session_id: str):
    """Return channel-mix data for AS-IS vs TO-BE TAT analysis."""
    sess = get_session(session_id)
    dfs = sess.get("dataframes") or {}
    col_map = sess.get("final_col_map") or {}
    po_df = dfs.get("po_df")
    if po_df is None:
        return {"asis": {"rc_pct": 40, "asl_pct": 30, "rfq_pct": 30, "weighted_tat": 52},
                "tobe": {"rc_pct": 60, "asl_pct": 25, "rfq_pct": 15, "weighted_tat": 28}}
    try:
        from routers.kpi_dashboard import _get_po_col, _kpi_rc_adoption
        rc_vol, _ = _kpi_rc_adoption(po_df, col_map)
        rc_pct = float(rc_vol.get("value", 40)) if rc_vol and rc_vol.get("available") else 40
        asl_pct = max(0, min(80, 100 - rc_pct - 20))
        rfq_pct = max(0, 100 - rc_pct - asl_pct)
        weighted_tat = (rc_pct * 3 + asl_pct * 25 + rfq_pct * 60) / 100
        # TO-BE: push RC to +20%
        tobe_rc = min(95, rc_pct + 20)
        tobe_asl = max(0, asl_pct - 5)
        tobe_rfq = max(0, 100 - tobe_rc - tobe_asl)
        tobe_tat = (tobe_rc * 3 + tobe_asl * 25 + tobe_rfq * 60) / 100
        return {
            "asis": {"rc_pct": round(rc_pct), "asl_pct": round(asl_pct), "rfq_pct": round(rfq_pct), "weighted_tat": round(weighted_tat)},
            "tobe": {"rc_pct": round(tobe_rc), "asl_pct": round(tobe_asl), "rfq_pct": round(tobe_rfq), "weighted_tat": round(tobe_tat)},
        }
    except Exception as e:
        return {"asis": {"rc_pct": 40, "asl_pct": 30, "rfq_pct": 30, "weighted_tat": 52},
                "tobe": {"rc_pct": 60, "asl_pct": 25, "rfq_pct": 15, "weighted_tat": 28}}


@router.get("/session/{session_id}/results/ai-usecases")
def get_ai_usecases(session_id: str):
    """Return AI use-cases matched to assessment gaps."""
    sess = get_session(session_id)
    kpi_assessment = sess.get("kpi_assessment")
    use_cases = [
        {"title": "Intelligent PO Auto-Approval", "description": "AI-driven rule engine automatically approves low-risk POs below threshold value, reducing TAT by 40%.", "relevant_kpis": ["tat","pac_prs"], "maturity_required": "Intermediate", "effort": "Medium", "benefit": "Reduce approval TAT by 40%"},
        {"title": "Rate Contract Coverage Optimiser", "description": "ML model identifies spend categories with RC coverage gaps and recommends contract expansion priorities.", "relevant_kpis": ["rc_adoption","savings_lpo"], "maturity_required": "Advanced", "effort": "High", "benefit": "Increase RC adoption by 15-20%"},
        {"title": "Vendor Risk Scoring Engine", "description": "Real-time vendor risk scores from financial, delivery, and quality data feed into sourcing decisions.", "relevant_kpis": ["otd","defect_rate"], "maturity_required": "Intermediate", "effort": "High", "benefit": "Reduce supply disruptions by 30%"},
        {"title": "Spend Anomaly Detection", "description": "Unsupervised ML flags unusual spending patterns, maverick buying, and policy violations in real-time.", "relevant_kpis": ["pac_prs","emergency_prs"], "maturity_required": "Foundation", "effort": "Low", "benefit": "Detect 85% of compliance issues automatically"},
        {"title": "Savings Leakage Predictor", "description": "Model predicts which negotiated savings are at risk of leakage at point of PO creation.", "relevant_kpis": ["savings_lpo","rc_adoption"], "maturity_required": "Advanced", "effort": "Medium", "benefit": "Recover 2-3% of contracted savings"},
        {"title": "Smart Category Intelligence", "description": "NLP engine processes supplier proposals, market reports, and price indices to surface category insights.", "relevant_kpis": ["savings_lpo"], "maturity_required": "Advanced", "effort": "High", "benefit": "Improve sourcing outcomes by 8-12%"},
    ]
    # Filter to relevant ones if assessment is available
    if kpi_assessment:
        for uc in use_cases:
            kpi_results = getattr(kpi_assessment, "kpi_results", {}) or {}
            uc["is_relevant"] = any(
                kpi_results.get(kid) and getattr(kpi_results[kid], "score", 5) <= 2
                for kid in uc["relevant_kpis"]
            )
    return {"use_cases": use_cases}
```

---

## 7. backend/routers/file_inspect.py

```python
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
    # Filename hints take priority
    fn_lower = filename.lower().replace(" ","_").replace("-","_")
    for hint, slot in FILENAME_HINTS.items():
        if hint in fn_lower:
            score = _score_columns(columns, slot)
            if score >= 0.15:  # at least some column match
                return slot, "high", f"Filename contains '{hint}' → {slot}"

    # Score all slots by column match
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
```

---

## 8. backend/routers/kpi_dashboard.py — Key Helper Functions

This is a very large file (~1400 lines). Key public functions used by other routers:

```python
# ── Column resolution helper ──────────────────────────────────────────────────
def _get_po_col(po_df, logical_name: str, col_map: dict) -> Optional[str]:
    """Find actual column in PO df by logical name. Tries col_map first,
    then candidate list, then fuzzy match."""
    # 1. col_map override
    if logical_name in col_map and col_map[logical_name] in po_df.columns:
        return col_map[logical_name]
    # 2. Candidate aliases
    CANDIDATES = {
        "net_value": ["Net_Value","net_value","Net Value","Total_Value","PO_Value","Order_Value","NETWR"],
        "vendor": ["Vendor","vendor","Vendor_Code","LIFNR","Supplier"],
        "plant": ["Plant","plant","Werks","WERKS"],
        "po_date": ["PO_Creation_Date","PO_Date","Document_Date","BEDAT"],
        "material_group": ["Material_Group","Material_Grp","MATKL","MatGrp"],
        "material_group_desc": ["Material_Group_Desc","Matl_Grp_Desc"],
        "purchase_group": ["Purchase_Group","Purchasing_Group","EKGRP"],
        "outline_agreement": ["Outline_Agreement","Framework_Order","KONNR"],
        "contract_number": ["Contract_Number","Contract_No","KONNR"],
        "agreement": ["agreement","agreement_number","Outline_Agreement","Contract_Number"],
        "gr_date": ["GR_Date","Goods_Receipt_Date","Entry_Date","BUDAT"],
        "pr_delivery_date": ["Delivery_Date","Sched_Del_Date","EINDT"],
        "short_text": ["Short_Text","Material_Description","TXZ01"],
        "po_number": ["PO_Number","Purchase_Order","EBELN"],
        "pr_reference": ["PR_Reference","PR_Ref","BANFN","Requisition_No"],
        "net_price": ["Net_Price","Unit_Price","NETPR"],
        "material_number": ["Material_Number","Material","MATNR"],
        "material_type": ["Material_Type","Mat_Type","MTART"],
        "vendor_name": ["Vendor_Name","Name_1","NAME1"],
        "last_po_price": ["last po price","last_po_price","LPO_Price"],
    }
    cands = CANDIDATES.get(logical_name, [logical_name])
    for c in cands:
        if c in po_df.columns: return c
        # case-insensitive
        for col in po_df.columns:
            if col.lower() == c.lower(): return col
    return None


# ── 8-KPI computation functions ───────────────────────────────────────────────

def _to_cr(value_rupees: float) -> float:
    """Convert rupees to crores (÷ 1e7)."""
    return float(value_rupees) / 1e7

def _tat_trim(arr, low_pct=5, high_pct=95):
    """Trim TAT array to P5-P95 to remove outliers."""
    import numpy as np
    if len(arr) < 3: return arr
    lo, hi = np.percentile(arr, [low_pct, high_pct])
    return arr[(arr >= lo) & (arr <= hi)]

def _monthly_trend(df, date_col, value_col, agg_fn="mean"):
    """Build monthly trend [{month: "2024-01", value: 42.3}, ...]"""
    import pandas as pd
    try:
        tmp = df[[date_col, value_col]].copy()
        tmp[date_col] = pd.to_datetime(tmp[date_col], errors="coerce")
        tmp[value_col] = pd.to_numeric(tmp[value_col], errors="coerce")
        tmp = tmp.dropna()
        tmp["month"] = tmp[date_col].dt.to_period("M").astype(str)
        if agg_fn == "mean": agg = tmp.groupby("month")[value_col].mean()
        elif agg_fn == "sum": agg = tmp.groupby("month")[value_col].sum()
        else: agg = tmp.groupby("month")[value_col].count()
        return [{"month": m, "value": round(float(v), 2)} for m, v in agg.items()]
    except Exception: return []


def _kpi_tat_pr_to_po(po_df, pr_df, col_map, params=None):
    """Compute PR-to-PO TAT (days). Returns KpiData dict."""
    import pandas as pd, numpy as np
    try:
        po_date_col = _get_po_col(po_df, "po_date", col_map)
        pr_date_col = None
        # Try join path: pr_df has pr_date, po_df has pr_reference
        if pr_df is not None and not pr_df.empty:
            pr_num_col = next((c for c in ["PR_Number","pr_number","pr no","PR_No"] if c in pr_df.columns), None)
            pr_date_col_in_pr = next((c for c in ["PR_Creation_Date","pr_date","pr_creation_date"] if c in pr_df.columns), None)
            po_pr_ref_col = _get_po_col(po_df, "pr_reference", col_map)
            if pr_num_col and pr_date_col_in_pr and po_pr_ref_col:
                pr_dates = pr_df[[pr_num_col, pr_date_col_in_pr]].rename(
                    columns={pr_num_col: "_pr_key", pr_date_col_in_pr: "_pr_date"}
                )
                merged = po_df[[po_date_col, po_pr_ref_col]].rename(
                    columns={po_pr_ref_col: "_pr_key"}
                ).merge(pr_dates, on="_pr_key", how="inner")
                if len(merged) > 0:
                    po_dates = pd.to_datetime(merged[po_date_col], errors="coerce")
                    pr_dates_s = pd.to_datetime(merged["_pr_date"], errors="coerce")
                    tats = (po_dates - pr_dates_s).dt.days.dropna()
                    tats = tats[tats > 0]
                    params = params or {}
                    lo = params.get("outlier_trim_low", 5)
                    hi = params.get("outlier_trim_high", 95)
                    tats_arr = np.array(tats)
                    tats_arr = _tat_trim(tats_arr, lo, hi)
                    if len(tats_arr) > 0:
                        avg_tat = float(np.mean(tats_arr))
                        trend = _monthly_trend(merged.assign(_tat=(po_dates - pr_dates_s).dt.days), po_date_col, "_tat", "mean")
                        return {
                            "id": "tat_pr_to_po", "label": "PR-to-PO TAT",
                            "available": True, "value": round(avg_tat, 1),
                            "unit": "days", "benchmark": 45,
                            "direction": "lower_is_better",
                            "trend": trend[:24],
                            "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
                            "confidence": "high" if len(tats_arr) >= 50 else "medium",
                            "row_count": len(tats_arr),
                        }
        return {"id": "tat_pr_to_po", "label": "PR-to-PO TAT", "available": False, "value": None,
                "unit": "days", "benchmark": 45, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
    except Exception as e:
        print(f"[kpi_tat] ERROR: {e}")
        return {"id": "tat_pr_to_po", "label": "PR-to-PO TAT", "available": False, "value": None,
                "unit": "days", "benchmark": 45, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_rc_adoption(po_df, col_map, params=None):
    """RC adoption by volume and value. Returns (vol_kpi, val_kpi)."""
    import pandas as pd
    try:
        # Combined agreement column (pre-built in run.py, but build fallback here)
        rc_col = next((c for c in ["agreement","agreement_number"] if c in po_df.columns), None)
        if rc_col is None:
            contract_col = _get_po_col(po_df, "contract_number", col_map)
            outline_col = _get_po_col(po_df, "outline_agreement", col_map)
            rc_flag = pd.Series(False, index=po_df.index)
            if contract_col: rc_flag |= po_df[contract_col].notna() & (po_df[contract_col].astype(str).str.strip() != "")
            if outline_col: rc_flag |= po_df[outline_col].notna() & (po_df[outline_col].astype(str).str.strip() != "")
        else:
            rc_flag = po_df[rc_col].notna() & (po_df[rc_col].astype(str).str.strip() != "")
        if len(po_df) == 0:
            return ({"available": False}, {"available": False})
        rc_vol_pct = round(float(rc_flag.mean() * 100), 1)
        nv_col = _get_po_col(po_df, "net_value", col_map)
        rc_val_pct = None
        if nv_col:
            nv = pd.to_numeric(po_df[nv_col], errors="coerce").fillna(0)
            total = nv.sum()
            if total > 0: rc_val_pct = round(float(nv[rc_flag].sum() / total * 100), 1)
        vol_kpi = {
            "id": "rc_adoption_volume", "label": "RC Adoption (Volume)",
            "available": True, "value": rc_vol_pct,
            "unit": "%", "benchmark": 80, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
            "confidence": "high" if len(po_df) >= 50 else "medium",
        }
        val_kpi = {
            "id": "rc_adoption_value", "label": "RC Adoption (Value)",
            "available": rc_val_pct is not None, "value": rc_val_pct,
            "unit": "%", "benchmark": 75, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
        return (vol_kpi, val_kpi)
    except Exception as e:
        print(f"[kpi_rc] ERROR: {e}")
        return ({"available": False}, {"available": False})


def _kpi_supplier_otd(po_df, col_map, params=None):
    import pandas as pd
    try:
        gr_col = _get_po_col(po_df, "gr_date", col_map)
        del_col = _get_po_col(po_df, "pr_delivery_date", col_map)
        if not gr_col or not del_col:
            return {"id": "supplier_otd", "label": "Supplier OTD", "available": False, "value": None,
                    "unit": "%", "benchmark": 91, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        tmp = po_df[[gr_col, del_col]].copy()
        tmp["gr"] = pd.to_datetime(tmp[gr_col], errors="coerce")
        tmp["del"] = pd.to_datetime(tmp[del_col], errors="coerce")
        tmp = tmp.dropna()
        grace = (params or {}).get("grace_period_days", 0)
        on_time = (tmp["gr"] <= tmp["del"] + pd.Timedelta(days=grace))
        otd_pct = round(float(on_time.mean() * 100), 1) if len(tmp) > 0 else None
        return {
            "id": "supplier_otd", "label": "Supplier OTD", "available": otd_pct is not None,
            "value": otd_pct, "unit": "%", "benchmark": 91, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
            "confidence": "high" if len(tmp) >= 50 else "medium",
        }
    except Exception as e:
        return {"id": "supplier_otd", "label": "Supplier OTD", "available": False, "value": None,
                "unit": "%", "benchmark": 91, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_savings_lpo(po_df, col_map):
    import pandas as pd, numpy as np
    try:
        price_col = next((c for c in ["net price","net_price"] if c in po_df.columns), None)
        lpo_col   = next((c for c in ["last po price","last_po_price"] if c in po_df.columns), None)
        if not price_col or not lpo_col:
            return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        tmp = po_df[[price_col, lpo_col]].copy()
        tmp["price"] = pd.to_numeric(tmp[price_col], errors="coerce")
        tmp["lpo"]   = pd.to_numeric(tmp[lpo_col], errors="coerce")
        tmp = tmp.dropna()
        tmp = tmp[tmp["lpo"] > 0]
        if len(tmp) == 0:
            return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        savings_pct = ((tmp["lpo"] - tmp["price"]) / tmp["lpo"] * 100)
        # Trim P5-P95
        lo, hi = np.percentile(savings_pct, [5, 95])
        savings_pct = savings_pct[(savings_pct >= lo) & (savings_pct <= hi)]
        avg_savings = round(float(savings_pct.mean()), 1) if len(savings_pct) > 0 else None
        return {
            "id": "savings_lpo", "label": "Savings over LPO", "available": avg_savings is not None,
            "value": avg_savings, "unit": "%", "benchmark": 5, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
    except Exception as e:
        return {"id": "savings_lpo", "label": "Savings over LPO", "available": False, "value": None,
                "unit": "%", "benchmark": 5, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_pac_prs(po_df, pr_df, col_map):
    """Single-source / PAC PRs %."""
    import pandas as pd
    try:
        if pr_df is None or pr_df.empty:
            return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        vendor_col = next((c for c in ["Preferred_Vendor","Fixed_Vendor","pr_vendor","Vendor"] if c in pr_df.columns), None)
        if not vendor_col:
            return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        has_vendor = pr_df[vendor_col].notna() & (pr_df[vendor_col].astype(str).str.strip() != "")
        pac_pct = round(float(has_vendor.mean() * 100), 1)
        return {
            "id": "pac_prs", "label": "Single-Source PRs", "available": True,
            "value": pac_pct, "unit": "%", "benchmark": 5, "direction": "lower_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
    except Exception as e:
        return {"id": "pac_prs", "label": "Single-Source PRs", "available": False, "value": None,
                "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_emergency_prs(pr_df, col_map):
    import pandas as pd
    try:
        if pr_df is None or pr_df.empty:
            return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        # Look for PR type / urgency column
        type_col = next((c for c in ["PR_Type","Priority","Urgency","Document_Type","pr_type"] if c in pr_df.columns), None)
        if not type_col:
            return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                    "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        urgent_keywords = ["emergency","urgent","rush","express","undef","immediate","hot"]
        is_emerg = pr_df[type_col].astype(str).str.lower().apply(
            lambda v: any(k in v for k in urgent_keywords)
        )
        pct = round(float(is_emerg.mean() * 100), 1)
        return {
            "id": "emergency_prs", "label": "Emergency PRs", "available": True,
            "value": pct, "unit": "%", "benchmark": 5, "direction": "lower_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
    except Exception as e:
        return {"id": "emergency_prs", "label": "Emergency PRs", "available": False, "value": None,
                "unit": "%", "benchmark": 5, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _kpi_tail_spend(po_df, col_map, threshold_pct=1.0):
    import pandas as pd
    try:
        vendor_col = _get_po_col(po_df, "vendor", col_map)
        nv_col = _get_po_col(po_df, "net_value", col_map)
        if not vendor_col or not nv_col:
            return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                    "benchmark": 20, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        nv = pd.to_numeric(po_df[nv_col], errors="coerce").fillna(0)
        total_spend = nv.sum()
        if total_spend == 0:
            return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                    "benchmark": 20, "direction": "lower_is_better",
                    "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}
        vendor_spend = po_df.assign(_nv=nv).groupby(vendor_col)["_nv"].sum()
        vendor_pct = vendor_spend / total_spend * 100
        tail_mask = vendor_pct < threshold_pct
        tail_spend = vendor_spend[tail_mask].sum()
        tail_pct = round(float(tail_spend / total_spend * 100), 1)
        return {
            "id": "tail_spend_pct", "label": "Tail Spend %", "available": True,
            "value": tail_pct, "unit": "%", "benchmark": 20, "direction": "lower_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
    except Exception as e:
        return {"id": "tail_spend_pct", "available": False, "value": None, "unit": "%",
                "benchmark": 20, "direction": "lower_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": []}


def _compute_kpi_dashboard(session_id: str, plant: str = "", category: str = "",
                            purchase_group: str = "", date_from: str = "", date_to: str = "") -> dict:
    """Main dashboard computation — called by the GET endpoint and by AI insights."""
    from session_store import get_session
    import pandas as pd
    sess = get_session(session_id)
    dfs = sess.get("dataframes", {})
    col_map = sess.get("final_col_map") or {}
    engagement = sess.get("engagement") or {}

    po_df = dfs.get("po_df")
    pr_df = dfs.get("pr_df") if dfs.get("pr_df") is not None else pd.DataFrame()
    if po_df is None:
        raise ValueError("No PO data in session")

    # Apply filters
    po_f = po_df.copy()
    pr_f = pr_df.copy() if not pr_df.empty else pr_df

    nv_col = _get_po_col(po_f, "net_value", col_map)
    plant_col = _get_po_col(po_f, "plant", col_map)
    cat_col = _get_po_col(po_f, "material_group", col_map)
    pg_col = _get_po_col(po_f, "purchase_group", col_map)
    date_col = _get_po_col(po_f, "po_date", col_map)

    if plant and plant_col and plant in po_f[plant_col].values: po_f = po_f[po_f[plant_col] == plant]
    if category and cat_col and category in po_f[cat_col].values: po_f = po_f[po_f[cat_col] == category]
    if purchase_group and pg_col and purchase_group in po_f[pg_col].values: po_f = po_f[po_f[pg_col] == purchase_group]
    if date_from and date_col:
        try:
            po_f[date_col] = pd.to_datetime(po_f[date_col], errors="coerce")
            po_f = po_f[po_f[date_col] >= pd.to_datetime(date_from)]
        except Exception: pass
    if date_to and date_col:
        try:
            po_f = po_f[po_f[date_col] <= pd.to_datetime(date_to)]
        except Exception: pass

    # Compute all KPIs
    rc_vol, rc_val = _kpi_rc_adoption(po_f, col_map)
    kpis = {
        "tat_pr_to_po":       _kpi_tat_pr_to_po(po_f, pr_f, col_map),
        "rc_adoption_volume": rc_vol,
        "rc_adoption_value":  rc_val,
        "supplier_otd":       _kpi_supplier_otd(po_f, col_map),
        "savings_lpo":        _kpi_savings_lpo(po_f, col_map),
        "pac_prs":            _kpi_pac_prs(po_f, pr_f, col_map),
        "emergency_prs":      _kpi_emergency_prs(pr_f, col_map),
        "tail_spend_pct":     _kpi_tail_spend(po_f, col_map),
    }

    # Spend KPIs
    total_spend_cr = 0.0
    if nv_col:
        nv = pd.to_numeric(po_f[nv_col], errors="coerce").fillna(0)
        total_spend_cr = _to_cr(float(nv.sum()))
        fte = engagement.get("fte_count")
        spend_per_fte = round(total_spend_cr / fte, 2) if fte and fte > 0 else None
        kpis["spend_per_fte"] = {
            "id": "spend_per_fte", "label": "Spend per FTE",
            "available": spend_per_fte is not None, "value": spend_per_fte,
            "unit": "₹ Cr", "benchmark": 15, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
        }
        # Spend by vendor (pareto)
        vendor_col = _get_po_col(po_f, "vendor", col_map)
        by_vendor = []
        if vendor_col:
            vend_spend = po_f.assign(_nv=nv).groupby(vendor_col)["_nv"].sum().sort_values(ascending=False)
            total = float(vend_spend.sum())
            by_vendor = [
                {"name": str(v), "value": round(_to_cr(float(s)), 2),
                 "pct": round(float(s/total*100), 1) if total > 0 else 0}
                for v, s in vend_spend.head(20).items()
            ]
        kpis["proc_spend"] = {
            "id": "proc_spend", "label": "Procurement Spend",
            "available": True, "value": round(total_spend_cr, 2),
            "unit": "₹ Cr", "benchmark": None, "direction": "higher_is_better",
            "trend": [], "by_plant": [], "by_vendor": by_vendor, "by_category": [], "by_purchase_group": [],
        }

    # Pareto vendors
    vendor_col = _get_po_col(po_f, "vendor", col_map)
    if vendor_col and nv_col:
        nv = pd.to_numeric(po_f[nv_col], errors="coerce").fillna(0)
        vend_spend = po_f.assign(_nv=nv).groupby(vendor_col)["_nv"].sum().sort_values(ascending=False)
        total = float(vend_spend.sum())
        if total > 0:
            n_top20 = max(1, int(len(vend_spend) * 0.2))
            top20_pct = round(float(vend_spend.head(n_top20).sum() / total * 100), 1)
            kpis["pareto_vendors"] = {
                "id": "pareto_vendors", "label": "Pareto Vendor Concentration",
                "available": True, "value": top20_pct,
                "unit": "%", "benchmark": 80, "direction": "higher_is_better",
                "trend": [], "by_plant": [], "by_vendor": [], "by_category": [], "by_purchase_group": [],
            }

    # Summary stats
    po_count = len(po_f)
    vendor_count = int(po_f[vendor_col].nunique()) if vendor_col else 0
    date_range = None
    if date_col:
        try:
            dates = pd.to_datetime(po_f[date_col], errors="coerce").dropna()
            if len(dates) > 0:
                date_range = {"min": str(dates.min().date()), "max": str(dates.max().date())}
        except Exception: pass

    summary = {"total_spend_cr": round(total_spend_cr, 2), "po_count": po_count,
               "vendor_count": vendor_count, "date_range": date_range}

    # Filter options
    filters = {
        "plants": sorted(po_df[plant_col].dropna().unique().tolist()) if plant_col else [],
        "categories": sorted(po_df[cat_col].dropna().unique().tolist()) if cat_col else [],
        "purchase_groups": sorted(po_df[pg_col].dropna().unique().tolist()) if pg_col else [],
    }

    return {
        "kpis": kpis,
        "summary": summary,
        "filters": filters,
        "low_confidence": po_count < 50,
        "row_count": po_count,
    }


router = APIRouter(tags=["kpi_dashboard"])


@router.get("/session/{session_id}/results/kpi-dashboard")
def get_kpi_dashboard(
    session_id: str,
    plant: str = "", category: str = "", purchase_group: str = "",
    date_from: str = "", date_to: str = "",
):
    try:
        return _compute_kpi_dashboard(session_id, plant, category, purchase_group, date_from, date_to)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 9. backend/routers/formula_review.py

See complete file — it's fully reproduced earlier in this conversation.
Key endpoints:
- `GET /session/{id}/results/formula-config` — returns 8-KPI formula catalogue with current overrides
- `POST /session/{id}/results/formula-overrides` — saves benchmark/multiplier overrides
- `DELETE /session/{id}/results/formula-overrides` — clears all overrides
- `POST /session/{id}/results/apply-formula-overrides` — re-scores kpi_assessment with new benchmarks
- `GET/POST /session/{id}/results/formula-params` — configurable calculation parameters (TAT trim, OTD grace)

Default benchmarks: TAT=45d, RC=80%, OTD=91%, Savings=5%, Spend/FTE=15 Cr, Defect=2.5%, Sourcing=80%, PAC=5%

---

## 10. backend/routers/ai_insights.py

See complete file — fully reproduced in the read output.
Key points:
- Vertex AI Gemini 2.5 Pro via ADC (no API keys)
- Project: gen-lang-client-0226029743 / Location: us-central1
- `_get_model()` — lazy init, _model_tried prevents retries
- `_gemini_generate(prompt)` — generates + strips markdown fences from JSON response
- `_build_rich_context()` — builds detailed data context with drilldowns
- `_build_prompt()` — main 5-rule prompt (grounding rules, JSON schema)
- `_build_tab_prompt()` — 3 context variants: kpi_overview, rca, offerings
- Rule-based fallback when Vertex AI unavailable
- Questionnaire evidence + discovery QRE both appended to prompts
- Tab insights cached in session as `ai_tab_insights_{context}`
- `POST /ai-buying-categories` — Gemini-powered category structure generator

---

## 11. backend/routers/ppt_export.py (Structure)

The PPT export router generates two decks:

### KPI Dashboard Deck (GET /session/{id}/results/export/ppt)
13 slides:
1. Title / cover slide (client name, date, Accenture branding)
2. Executive summary (overall score gauge + key finding)
3. KPI scorecard (all 8 KPIs with actuals vs benchmarks)
4. Efficiency bucket deep-dive (TAT, RC Adoption)
5. Effectiveness bucket (Savings/LPO, Spend/FTE)
6. Vendor Management bucket (OTD, Defect Rate)
7. Risk bucket (PAC PRs, Emergency PRs)
8. Spend analysis (pareto chart)
9. Root Cause Analysis summary
10. Priority actions (top 4)
11. Quick wins
12. Recommended offerings
13. Appendix / data sources

### Proposal Deck (GET /session/{id}/results/export/ppt/proposal)
18 slides — transformation proposal deck with:
- Current state analysis
- Gap analysis per bucket
- 8 workstreams defined: Op Model, Process, Category, Cost Takeout, Technology, SRM, Capability, Data & Analytics
- Programme roadmap (Gantt-style, 3 phases)
- Investment estimate

### Program Timeline (GET/POST /session/{id}/program-timeline)
Stores timeline configuration: duration (90d/6m/12m), include_slides flags.

```python
WORKSTREAMS = [
    {"id": "op_model",    "title": "Operating Model & Organisation",     "colour": "#a100ff"},
    {"id": "process",     "title": "Process Design & Optimisation",      "colour": "#7500c0"},
    {"id": "category",    "title": "Category & Channel Optimisation",    "colour": "#460073"},
    {"id": "cost_takeout","title": "Cost Takeout Programme",             "colour": "#0070c0"},
    {"id": "tech",        "title": "Digital Procurement Technology",     "colour": "#00b0f0"},
    {"id": "srm",         "title": "Supplier Relationship Management",   "colour": "#00b050"},
    {"id": "capability",  "title": "Capability Building & Change Mgmt", "colour": "#ff7c00"},
    {"id": "data",        "title": "Data & Analytics Foundation",        "colour": "#ffc000"},
]
```
