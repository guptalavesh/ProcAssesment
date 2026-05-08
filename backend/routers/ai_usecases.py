"""AI use-cases endpoint group.

The use-case CATALOGUE itself is exposed by /results/ai-usecases (in
results.py). This router adds the BUSINESS-CASE CALCULATOR endpoint that
quantifies the impact of a single agent / use-case for the engagement —
hours saved, FTE equivalents, cost savings, and TAT reduction.
"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from session_store import get_session

router = APIRouter(tags=["ai_usecases"])


# ── Default automation profiles per agent ────────────────────────────────────
# Each profile names:
#   fte_automation_pct — share of the targeted task's FTE effort the agent
#                        offsets (0.0-1.0)
#   tat_reduction_pct  — share of the cycle time the agent removes
#   complexity         — Low / Medium / High implementation lift
#   edge               — what makes the agent valuable in one phrase
#   linked_kpis        — engine KPI ids whose has_gap flips the agent to
#                        "high relevance" for the engagement
AGENT_PROFILES: Dict[str, Dict[str, Any]] = {
    "smart_vendor_onboarding": {
        "name": "Smart Vendor Onboarding",
        "phase": "Supplier Onboarding & Master Data",
        "edge": "Cuts vendor onboarding from 10–14 days to under 24 hours by automating registration, validation and qualification.",
        "complexity": "Medium",
        "fte_automation_pct": 0.60, "tat_reduction_pct": 0.85,
        "linked_kpis": ["otd", "pac_3way_match"],
    },
    "master_data_engine": {
        "name": "Master Data Management Engine",
        "phase": "Supplier Onboarding & Master Data",
        "edge": "Standardises material master data with duplicate detection — typically reclaims 15–25% of master records as duplicates or mis-classified.",
        "complexity": "Medium",
        "fte_automation_pct": 0.40, "tat_reduction_pct": 0.30,
        "linked_kpis": ["spend_per_fte"],
    },
    "demand_prediction": {
        "name": "Demand Prediction Agent",
        "phase": "Procurement Planning",
        "edge": "Forward-looking demand forecasts off PR history + production plans + market signals — reduces emergency PRs and stock-outs.",
        "complexity": "High",
        "fte_automation_pct": 0.25, "tat_reduction_pct": 0.40,
        "linked_kpis": ["emergency_pr_pct", "tat_pr_to_po"],
    },
    "pr_quality_assurance": {
        "name": "PR Quality Assurance Agent",
        "phase": "Procurement Planning",
        "edge": "Validates PRs at point of creation — material codes, inventory levels, SOW compliance, duplicate detection. Cuts PR rework loops by 50–70%.",
        "complexity": "Medium",
        "fte_automation_pct": 0.55, "tat_reduction_pct": 0.45,
        "linked_kpis": ["tat_pr_to_po", "pac_3way_match"],
    },
    "vendor_discovery": {
        "name": "Vendor Discovery Agent",
        "phase": "Vendor Identification & RFx",
        "edge": "Internal + external intelligence mining + AI-driven ranking — shortens vendor shortlisting from weeks to hours.",
        "complexity": "Medium",
        "fte_automation_pct": 0.50, "tat_reduction_pct": 0.65,
        "linked_kpis": ["tat_pr_to_po", "pac_prs"],
    },
    "pr_consolidation": {
        "name": "PR Consolidation Agent",
        "phase": "Vendor Identification & RFx",
        "edge": "LLM-grouped consolidation of similar PRs into a single RFQ — typically recovers 3–6% on volume leverage.",
        "complexity": "Medium",
        "fte_automation_pct": 0.40, "tat_reduction_pct": 0.30,
        "linked_kpis": ["savings_per_lpo", "rc_adoption_volume"],
    },
    "intelligent_rfx": {
        "name": "Intelligent RFx Creation Agent",
        "phase": "Vendor Identification & RFx",
        "edge": "End-to-end RFx creation, vendor floating and routing — turns RFx process from days into a guided session.",
        "complexity": "High",
        "fte_automation_pct": 0.55, "tat_reduction_pct": 0.55,
        "linked_kpis": ["tat_pr_to_po", "rc_adoption_volume"],
    },
    "negotiation_copilot": {
        "name": "Buyer Negotiation Copilot",
        "phase": "Tech & Commercial Evaluation",
        "edge": "Real-time negotiation intelligence + insights briefs — typically lifts savings 1–3% above buyer-only baselines.",
        "complexity": "High",
        "fte_automation_pct": 0.30, "tat_reduction_pct": 0.20,
        "linked_kpis": ["savings_per_lpo"],
    },
    "category_workbook": {
        "name": "Category Workbook Agent",
        "phase": "Tech & Commercial Evaluation",
        "edge": "Automates category workbook creation — data ingestion, framework application, roadmap generation.",
        "complexity": "Medium",
        "fte_automation_pct": 0.45, "tat_reduction_pct": 0.50,
        "linked_kpis": ["savings_per_lpo", "rc_adoption_volume"],
    },
    "low_value_autonomous": {
        "name": "Low Value Autonomous Agent",
        "phase": "Tech & Commercial Evaluation",
        "edge": "Fully automates negotiation for low-value items with counter-offer logic — touchless awards on the long tail.",
        "complexity": "Medium",
        "fte_automation_pct": 0.85, "tat_reduction_pct": 0.80,
        "linked_kpis": ["tat_pr_to_po", "tail_spend"],
    },
    "award_recommendation": {
        "name": "Award Recommendation Engine",
        "phase": "Tech & Commercial Evaluation",
        "edge": "Consolidates commercial + technical data, calculates optimal award scenarios, automates DoP routing.",
        "complexity": "Medium",
        "fte_automation_pct": 0.40, "tat_reduction_pct": 0.35,
        "linked_kpis": ["tat_pr_to_po"],
    },
    "po_terms_validation": {
        "name": "PO Terms Validation Agent",
        "phase": "NFA & PO Creation",
        "edge": "Extracts critical terms from PO text and validates against codified fields — catches 90%+ of clause errors pre-issue.",
        "complexity": "Low",
        "fte_automation_pct": 0.60, "tat_reduction_pct": 0.30,
        "linked_kpis": ["pac_3way_match"],
    },
    "automated_po_expeditor": {
        "name": "Automated PO Expeditor",
        "phase": "NFA & PO Creation",
        "edge": "Monitors PO progress, sends supplier reminders, flags potential delays — improves OTD without buyer intervention.",
        "complexity": "Low",
        "fte_automation_pct": 0.70, "tat_reduction_pct": 0.40,
        "linked_kpis": ["otd"],
    },
}


@router.get("/ai-usecases/agents")
def list_agents():
    """Return the agent catalogue + their default automation profiles."""
    return {
        "agents": [
            {"id": aid, **profile} for aid, profile in AGENT_PROFILES.items()
        ],
    }


class BusinessCaseInputs(BaseModel):
    agent_id: str
    fte_count: float = 5.0           # FTEs currently doing this task
    tx_per_month: float = 1000.0     # transactions/month routed through the agent
    cost_per_fte_lakhs: float = 12.0 # fully-loaded cost per FTE per year (₹ Lakhs)
    hours_per_tx: float = 0.25       # baseline manual hours per transaction
    working_days_per_year: int = 240


@router.post("/session/{session_id}/ai-usecases/business-case")
def compute_business_case(session_id: str, payload: BusinessCaseInputs):
    """Quantify the savings + cycle-time impact of deploying one agent for
    this engagement."""
    sess = get_session(session_id)  # validates the session exists
    profile = AGENT_PROFILES.get(payload.agent_id)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"Unknown agent_id: {payload.agent_id}")

    annual_tx          = payload.tx_per_month * 12
    total_manual_hours = annual_tx * payload.hours_per_tx
    fte_capacity_hours = payload.working_days_per_year * 8  # 8h / day baseline
    fte_equivalent_baseline = total_manual_hours / fte_capacity_hours if fte_capacity_hours else 0.0

    fte_offset_pct = profile["fte_automation_pct"]
    hours_saved    = total_manual_hours * fte_offset_pct
    fte_saved      = fte_equivalent_baseline * fte_offset_pct

    annual_cost_saved_lakhs = fte_saved * payload.cost_per_fte_lakhs
    annual_cost_saved_cr    = round(annual_cost_saved_lakhs / 100.0, 2)
    tat_reduction_pct       = round(profile["tat_reduction_pct"] * 100, 1)

    # KPI relevance — flag whether any linked KPI has a gap in this session
    ka = sess.get("kpi_assessment")
    relevant_kpis: List[str] = []
    if ka is not None:
        kpi_results = getattr(ka, "kpi_results", None) or {}
        for kid in profile.get("linked_kpis", []):
            kr = kpi_results.get(kid)
            score = getattr(kr, "score", None) if kr is not None else None
            if kr is not None and score is not None and score <= 2:
                relevant_kpis.append(getattr(kr, "label", kid))

    return {
        "agent_id":   payload.agent_id,
        "agent_name": profile["name"],
        "phase":      profile["phase"],
        "edge":       profile["edge"],
        "complexity": profile["complexity"],
        "inputs":     payload.dict(),
        "results": {
            "annual_transactions":   int(annual_tx),
            "total_manual_hours_pa": round(total_manual_hours, 0),
            "hours_saved_pa":        round(hours_saved, 0),
            "fte_equivalent_saved":  round(fte_saved, 2),
            "cost_saving_cr":        annual_cost_saved_cr,
            "tat_reduction_pct":     tat_reduction_pct,
            "fte_automation_pct":    round(fte_offset_pct * 100, 1),
        },
        "kpis_addressed": relevant_kpis,
        "narrative": (
            f"Deploying the {profile['name']} on this engagement saves an estimated "
            f"{round(hours_saved):,} hours per year (~{round(fte_saved, 1)} FTE equivalent), "
            f"about ₹{annual_cost_saved_cr} Cr in fully-loaded cost. Cycle-time on the "
            f"automated step drops by {tat_reduction_pct}%."
        ),
    }
