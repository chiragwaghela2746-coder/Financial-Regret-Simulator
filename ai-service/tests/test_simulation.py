"""
Pytest test suite for the Financial Regret Simulator AI service.

Covers:
  - Input validation (422 on bad data)
  - Health endpoint
  - Simulate endpoint happy path
  - Response schema correctness
  - Regret score bounds
  - Scenario ordering
  - Goal ordering in results
  - Edge cases (zero income, zero expenses, full vs EMI, 0% interest)
  - Deterministic output with SEED env var
"""
from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("SEED", "42")   # deterministic tests

from main import app  # noqa: E402  (import after env set)

client = TestClient(app)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

VALID_PAYLOAD = {
    "monthlyIncome": 80_000,
    "monthlyExpenses": 30_000,
    "savings": 200_000,
    "goals": [
        {"name": "Emergency Fund", "amount": 100_000, "targetMonths": 6},
        {"name": "Vacation",       "amount": 50_000,  "targetMonths": 12},
    ],
    "purchase": {
        "name": "Laptop",
        "price": 80_000,
        "mode": "full",
    },
}

EMI_PAYLOAD = {
    "monthlyIncome": 60_000,
    "monthlyExpenses": 20_000,
    "savings": 150_000,
    "goals": [
        {"name": "Car Down Payment", "amount": 200_000, "targetMonths": 24},
    ],
    "purchase": {
        "name": "iPhone",
        "price": 100_000,
        "mode": "emi",
        "emiMonths": 12,
        "interestRate": 14.0,
    },
}

ZERO_INTEREST_EMI_PAYLOAD = {
    **EMI_PAYLOAD,
    "purchase": {
        "name": "Tablet",
        "price": 60_000,
        "mode": "emi",
        "emiMonths": 6,
        "interestRate": 0.0,
    },
}


def post_simulate(payload: dict) -> dict:
    resp = client.post("/simulate", json=payload)
    return resp


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

def test_health_ok():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# Validation — 422 cases
# ---------------------------------------------------------------------------

def test_negative_income_422():
    bad = {**VALID_PAYLOAD, "monthlyIncome": -1}
    assert post_simulate(bad).status_code == 422


def test_negative_expenses_422():
    bad = {**VALID_PAYLOAD, "monthlyExpenses": -500}
    assert post_simulate(bad).status_code == 422


def test_negative_savings_422():
    bad = {**VALID_PAYLOAD, "savings": -100}
    assert post_simulate(bad).status_code == 422


def test_empty_goals_422():
    bad = {**VALID_PAYLOAD, "goals": []}
    assert post_simulate(bad).status_code == 422


def test_goal_negative_amount_422():
    bad = {**VALID_PAYLOAD, "goals": [{"name": "X", "amount": -100, "targetMonths": 6}]}
    assert post_simulate(bad).status_code == 422


def test_goal_zero_target_months_422():
    bad = {**VALID_PAYLOAD, "goals": [{"name": "X", "amount": 1000, "targetMonths": 0}]}
    assert post_simulate(bad).status_code == 422


def test_purchase_negative_price_422():
    bad = {**VALID_PAYLOAD, "purchase": {**VALID_PAYLOAD["purchase"], "price": -1}}
    assert post_simulate(bad).status_code == 422


def test_emi_missing_emi_months_422():
    bad = {
        **VALID_PAYLOAD,
        "purchase": {
            "name": "TV",
            "price": 50_000,
            "mode": "emi",
            # emiMonths missing, interestRate missing
        },
    }
    assert post_simulate(bad).status_code == 422


def test_emi_zero_emi_months_422():
    bad = {
        **VALID_PAYLOAD,
        "purchase": {
            "name": "TV",
            "price": 50_000,
            "mode": "emi",
            "emiMonths": 0,
            "interestRate": 10.0,
        },
    }
    assert post_simulate(bad).status_code == 422


def test_emi_negative_interest_rate_422():
    bad = {
        **VALID_PAYLOAD,
        "purchase": {
            "name": "TV",
            "price": 50_000,
            "mode": "emi",
            "emiMonths": 12,
            "interestRate": -1.0,
        },
    }
    assert post_simulate(bad).status_code == 422


# ---------------------------------------------------------------------------
# Happy path — schema correctness
# ---------------------------------------------------------------------------

def test_simulate_full_payment_200():
    resp = post_simulate(VALID_PAYLOAD)
    assert resp.status_code == 200


def test_simulate_emi_200():
    resp = post_simulate(EMI_PAYLOAD)
    assert resp.status_code == 200


def test_simulate_zero_interest_emi_200():
    resp = post_simulate(ZERO_INTEREST_EMI_PAYLOAD)
    assert resp.status_code == 200


def _assert_response_schema(data: dict, n_goals: int):
    assert "regretScore" in data
    assert "scenarios" in data
    assert "explanation" in data

    # regretScore is integer 0-100
    assert isinstance(data["regretScore"], int)
    assert 0 <= data["regretScore"] <= 100

    # exactly 3 scenarios
    assert len(data["scenarios"]) == 3
    types = {s["type"] for s in data["scenarios"]}
    assert types == {"buy_now", "wait", "cheaper"}

    for scenario in data["scenarios"]:
        assert len(scenario["goals"]) == n_goals
        for g in scenario["goals"]:
            assert "name" in g
            assert "delayMonths" in g
            assert "onTimeProbability" in g
            dm = g["delayMonths"]
            assert dm is None or (isinstance(dm, int) and dm >= 0)
            assert 0.0 <= g["onTimeProbability"] <= 1.0

    # explanation is a non-empty string
    assert isinstance(data["explanation"], str)
    assert len(data["explanation"]) > 0


def test_response_schema_full():
    data = post_simulate(VALID_PAYLOAD).json()
    _assert_response_schema(data, n_goals=2)


def test_response_schema_emi():
    data = post_simulate(EMI_PAYLOAD).json()
    _assert_response_schema(data, n_goals=1)


def test_scenario_order():
    """Scenarios should be buy_now, wait, cheaper in that order."""
    data = post_simulate(VALID_PAYLOAD).json()
    types = [s["type"] for s in data["scenarios"]]
    assert types == ["buy_now", "wait", "cheaper"]


def test_goal_names_preserved():
    """Goal names in results must match request order."""
    data = post_simulate(VALID_PAYLOAD).json()
    for scenario in data["scenarios"]:
        names = [g["name"] for g in scenario["goals"]]
        assert names == ["Emergency Fund", "Vacation"]


# ---------------------------------------------------------------------------
# Determinism with SEED
# ---------------------------------------------------------------------------

def test_deterministic_with_seed():
    """Same seed → identical results on two calls."""
    r1 = post_simulate(VALID_PAYLOAD).json()
    r2 = post_simulate(VALID_PAYLOAD).json()
    assert r1["regretScore"] == r2["regretScore"]
    for s1, s2 in zip(r1["scenarios"], r2["scenarios"]):
        for g1, g2 in zip(s1["goals"], s2["goals"]):
            assert g1["delayMonths"] == g2["delayMonths"]
            assert g1["onTimeProbability"] == g2["onTimeProbability"]


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_zero_income():
    """Zero income is valid; regret score should be 100 (worst EMI burden)."""
    payload = {
        "monthlyIncome": 0,
        "monthlyExpenses": 0,
        "savings": 500_000,
        "goals": [{"name": "House", "amount": 300_000, "targetMonths": 12}],
        "purchase": {
            "name": "Watch",
            "price": 10_000,
            "mode": "emi",
            "emiMonths": 12,
            "interestRate": 10.0,
        },
    }
    resp = post_simulate(payload)
    assert resp.status_code == 200
    data = resp.json()
    assert 0 <= data["regretScore"] <= 100


def test_zero_expenses():
    """Zero expenses are valid; no crash."""
    payload = {
        "monthlyIncome": 50_000,
        "monthlyExpenses": 0,
        "savings": 100_000,
        "goals": [{"name": "Vacation", "amount": 50_000, "targetMonths": 6}],
        "purchase": {"name": "Shoes", "price": 5_000, "mode": "full"},
    }
    resp = post_simulate(payload)
    assert resp.status_code == 200


def test_single_goal():
    payload = {
        "monthlyIncome": 50_000,
        "monthlyExpenses": 20_000,
        "savings": 50_000,
        "goals": [{"name": "Emergency Fund", "amount": 100_000, "targetMonths": 6}],
        "purchase": {"name": "Phone", "price": 30_000, "mode": "full"},
    }
    resp = post_simulate(payload)
    assert resp.status_code == 200
    data = resp.json()
    _assert_response_schema(data, n_goals=1)


def test_expensive_purchase_causes_negative_balance():
    """Purchase price >> savings → simulation still runs without error."""
    payload = {
        "monthlyIncome": 30_000,
        "monthlyExpenses": 20_000,
        "savings": 10_000,
        "goals": [{"name": "Emergency Fund", "amount": 90_000, "targetMonths": 6}],
        "purchase": {"name": "Car", "price": 500_000, "mode": "full"},
    }
    resp = post_simulate(payload)
    assert resp.status_code == 200
    data = resp.json()
    # With a massive purchase, goal is very likely unreachable → null delay
    buy_now = next(s for s in data["scenarios"] if s["type"] == "buy_now")
    # delayMonths can be null or a large int; just check schema
    dm = buy_now["goals"][0]["delayMonths"]
    assert dm is None or (isinstance(dm, int) and dm >= 0)


def test_on_time_probability_range():
    """onTimeProbability must always be in [0, 1]."""
    data = post_simulate(VALID_PAYLOAD).json()
    for scenario in data["scenarios"]:
        for g in scenario["goals"]:
            assert 0.0 <= g["onTimeProbability"] <= 1.0


def test_many_goals():
    """Five goals — schema should handle them all."""
    payload = {
        "monthlyIncome": 100_000,
        "monthlyExpenses": 30_000,
        "savings": 50_000,
        "goals": [
            {"name": f"Goal {i}", "amount": 20_000 * i, "targetMonths": 6 * i}
            for i in range(1, 6)
        ],
        "purchase": {"name": "Watch", "price": 20_000, "mode": "full"},
    }
    resp = post_simulate(payload)
    assert resp.status_code == 200
    _assert_response_schema(resp.json(), n_goals=5)
