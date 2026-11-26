"""
FastAPI application entry point.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from models import SimulationRequest, SimulationResponse, ScenarioResult, GoalResult
from simulation import run_simulation
from explanation import build_explanation

app = FastAPI(
    title="Financial Regret Simulator",
    description="Monte Carlo simulation of how a purchase affects your savings goals.",
    version="1.0.0",
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/simulate", response_model=SimulationResponse, status_code=200)
async def simulate(req: SimulationRequest) -> SimulationResponse:
    result = run_simulation(req)

    regret_score: int = result["regret_score"]
    raw_scenarios: list[dict] = result["scenarios"]

    # Build typed scenario list
    scenarios = [
        ScenarioResult(
            type=s["type"],
            goals=[
                GoalResult(
                    name=g["name"],
                    delayMonths=g["delayMonths"],
                    onTimeProbability=g["onTimeProbability"],
                )
                for g in s["goals"]
            ],
        )
        for s in raw_scenarios
    ]

    # Map scenario goals by type for explanation helper
    def goals_by_type(t: str) -> list[dict]:
        for s in raw_scenarios:
            if s["type"] == t:
                return s["goals"]
        return []

    explanation = build_explanation(
        purchase_name=req.purchase.name,
        purchase_price=req.purchase.price,
        regret_score=regret_score,
        buy_now_goals=goals_by_type("buy_now"),
        wait_goals=goals_by_type("wait"),
        cheaper_goals=goals_by_type("cheaper"),
        monthly_income=req.monthlyIncome,
        monthly_expenses=req.monthlyExpenses,
        savings=req.savings,
    )

    return SimulationResponse(
        regretScore=regret_score,
        scenarios=scenarios,
        explanation=explanation,
    )
