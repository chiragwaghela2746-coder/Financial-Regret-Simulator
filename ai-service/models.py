"""
Pydantic models for request / response validation.
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class Goal(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    targetMonths: int = Field(..., gt=0)


class Purchase(BaseModel):
    name: str = Field(..., min_length=1)
    price: float = Field(..., gt=0)
    mode: Literal["full", "emi"]
    emiMonths: Optional[int] = Field(default=None)
    interestRate: Optional[float] = Field(default=None)

    @model_validator(mode="after")
    def validate_emi_fields(self) -> "Purchase":
        if self.mode == "emi":
            if self.emiMonths is None or self.emiMonths <= 0:
                raise ValueError("emiMonths must be a positive integer when mode is 'emi'")
            if self.interestRate is None or self.interestRate < 0:
                raise ValueError("interestRate must be >= 0 when mode is 'emi'")
        return self


class SimulationRequest(BaseModel):
    monthlyIncome: float = Field(..., ge=0)
    monthlyExpenses: float = Field(..., ge=0)
    savings: float = Field(..., ge=0)
    goals: list[Goal] = Field(..., min_length=1)
    purchase: Purchase


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class GoalResult(BaseModel):
    name: str
    delayMonths: Optional[int]        # null = never reached in 60 months
    onTimeProbability: float          # 0–1


class ScenarioResult(BaseModel):
    type: Literal["buy_now", "wait", "cheaper"]
    goals: list[GoalResult]


class SimulationResponse(BaseModel):
    regretScore: int                  # 0–100, buy_now only
    scenarios: list[ScenarioResult]
    explanation: str
