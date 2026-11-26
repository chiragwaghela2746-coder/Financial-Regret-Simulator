"""
Core Monte Carlo simulation engine.

Design decisions / assumptions
-------------------------------
* 1 000 runs, 60-month horizon, optional SEED env var.
* Random draws are generated ONCE per run and shared across all three
  scenarios so that result differences reflect only the purchase decision.
* Expense randomness: uniform ±10 % of base monthly expenses each month.
* Surprise cost: 5 % chance per month, uniform in [25 %, 100 %] of base
  monthly expenses (drawn once per run, applied before goal-funding).
* Goals are funded in listing order; a goal is funded the first month the
  running balance (after all deductions) covers its full amount.
* Shortfall from a purchase deduction results in a negative balance that
  naturally accumulates until future income restores it.
* EMI formula: standard amortisation. 0 % interest = price / emiMonths per
  month.
* delayMonths = max(0, median(completion_month) - targetMonths).
  Runs that never complete contribute +∞ to the median calculation.
  If the median is +∞ (more than half of runs never complete), delayMonths
  is null.
* onTimeProbability = fraction of runs completing on or before targetMonths.
"""
from __future__ import annotations

import os
from typing import Optional

import numpy as np

from models import Goal, Purchase, SimulationRequest

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
N_RUNS = 1_000
N_MONTHS = 60
SURPRISE_PROB = 0.05
SURPRISE_MIN_FRAC = 0.25
SURPRISE_MAX_FRAC = 1.00
EXPENSE_VARIATION = 0.10          # ±10 %

# Scenario definitions: (type_name, purchase_month_1indexed, price_multiplier)
SCENARIOS = [
    ("buy_now", 1, 1.0),
    ("wait",    4, 1.0),
    ("cheaper", 1, 0.7),
]


# ---------------------------------------------------------------------------
# EMI helpers
# ---------------------------------------------------------------------------

def _monthly_emi(price: float, annual_rate: float, months: int) -> float:
    """Return the fixed monthly EMI (₹)."""
    if annual_rate == 0.0:
        return price / months
    r = annual_rate / 100 / 12          # monthly rate
    return price * r * (1 + r) ** months / ((1 + r) ** months - 1)


# ---------------------------------------------------------------------------
# Single-run, single-scenario simulator
# ---------------------------------------------------------------------------

def _simulate_run(
    *,
    income: float,
    base_expenses: float,
    start_savings: float,
    goals: list[Goal],
    purchase: Purchase,
    purchase_month: int,          # 1-indexed
    price_multiplier: float,
    expense_draws: np.ndarray,    # shape (N_MONTHS,)  uniform [0,1]
    surprise_trigger: np.ndarray, # shape (N_MONTHS,)  uniform [0,1]
    surprise_size: np.ndarray,    # shape (N_MONTHS,)  uniform [0,1]
) -> list[int | float]:
    """
    Simulate one run for one scenario.

    Returns a list of `completion_month` per goal (N_MONTHS+1 means never
    reached within 60 months; treated as infinity later).
    """
    effective_price = purchase.price * price_multiplier

    # Pre-compute EMI if applicable
    if purchase.mode == "emi":
        emi_amount = _monthly_emi(
            effective_price, purchase.interestRate, purchase.emiMonths
        )
        emi_duration = purchase.emiMonths
    else:
        emi_amount = 0.0
        emi_duration = 0

    balance = start_savings
    goal_amounts = [g.amount for g in goals]
    goal_funded = [False] * len(goals)
    completion_months: list[int | float] = [N_MONTHS + 1] * len(goals)

    for month in range(1, N_MONTHS + 1):
        idx = month - 1

        # 1. Income
        balance += income

        # 2. Expenses with ±10 % variation
        variation = 1.0 + (expense_draws[idx] * 2 - 1) * EXPENSE_VARIATION
        balance -= base_expenses * variation

        # 3. Surprise cost (5 % chance)
        if surprise_trigger[idx] < SURPRISE_PROB:
            surprise_frac = SURPRISE_MIN_FRAC + surprise_size[idx] * (
                SURPRISE_MAX_FRAC - SURPRISE_MIN_FRAC
            )
            balance -= base_expenses * surprise_frac

        # 4. Purchase deduction
        if month == purchase_month:
            if purchase.mode == "full":
                balance -= effective_price          # may go negative
            # EMI starts the same month as purchase_month
        if purchase.mode == "emi" and purchase_month <= month < purchase_month + emi_duration:
            balance -= emi_amount

        # 5. Fund goals in order (only if not yet funded)
        for i, (amount, funded) in enumerate(zip(goal_amounts, goal_funded)):
            if not funded and balance >= amount:
                balance -= amount
                goal_funded[i] = True
                completion_months[i] = month

    return completion_months


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_simulation(req: SimulationRequest) -> dict:
    """
    Run 1 000 Monte Carlo simulations and return structured results.

    Returns a dict with keys:
        scenarios: list of {type, goals: [{name, delayMonths, onTimeProbability}]}
        regret_score: int (0-100), buy_now scenario
    """
    # Seed
    seed_env = os.environ.get("SEED", "").strip()
    rng = np.random.default_rng(int(seed_env) if seed_env else None)

    # --- Generate shared random draws (shape: N_RUNS × N_MONTHS) ---
    expense_draws   = rng.uniform(0, 1, (N_RUNS, N_MONTHS))
    surprise_trigger = rng.uniform(0, 1, (N_RUNS, N_MONTHS))
    surprise_size    = rng.uniform(0, 1, (N_RUNS, N_MONTHS))

    income        = req.monthlyIncome
    base_expenses = req.monthlyExpenses
    start_savings = req.savings
    goals         = req.goals
    purchase      = req.purchase
    n_goals       = len(goals)

    scenario_results = []

    for scenario_type, purchase_month, price_mult in SCENARIOS:
        # completion_months_matrix: (N_RUNS, n_goals)
        completion_matrix = np.empty((N_RUNS, n_goals), dtype=float)

        for run in range(N_RUNS):
            completions = _simulate_run(
                income=income,
                base_expenses=base_expenses,
                start_savings=start_savings,
                goals=goals,
                purchase=purchase,
                purchase_month=purchase_month,
                price_multiplier=price_mult,
                expense_draws=expense_draws[run],
                surprise_trigger=surprise_trigger[run],
                surprise_size=surprise_size[run],
            )
            completion_matrix[run] = completions

        # Build goal results
        goal_results = []
        for gi, goal in enumerate(goals):
            col = completion_matrix[:, gi]  # shape (N_RUNS,)

            # Runs that reached the goal (completion_month <= N_MONTHS)
            reached_mask = col <= N_MONTHS

            # onTimeProbability
            on_time = float(np.mean(col <= goal.targetMonths))

            # delayMonths via median
            # Unreached runs contribute +∞ → if median is +∞, return null
            # numpy median doesn't handle inf; we use a manual approach.
            finite_completions = col[reached_mask]
            n_reached = int(reached_mask.sum())

            if n_reached == 0:
                # Every run failed → median = +∞ → null
                delay_months: Optional[int] = None
            else:
                # Build full array with np.inf for unreached
                full_col = col.copy()
                full_col[~reached_mask] = np.inf

                # Sorted median
                sorted_col = np.sort(full_col)
                mid = N_RUNS // 2  # 500 for 1000 runs
                # For even-length arrays: median = average of mid-1 and mid
                m1 = sorted_col[mid - 1]
                m2 = sorted_col[mid]

                if np.isinf(m1) or np.isinf(m2):
                    delay_months = None
                else:
                    median_completion = (m1 + m2) / 2.0
                    delay_months = int(max(0, median_completion - goal.targetMonths))

            goal_results.append({
                "name": goal.name,
                "delayMonths": delay_months,
                "onTimeProbability": round(on_time, 4),
            })

        scenario_results.append({
            "type": scenario_type,
            "goals": goal_results,
            "completion_matrix": completion_matrix,  # kept for regret calc
        })

    # --- Regret score (buy_now only) ---
    regret_score = _compute_regret_score(req, scenario_results[0]["completion_matrix"], goals)

    # Strip internal keys before returning
    for s in scenario_results:
        s.pop("completion_matrix", None)

    return {
        "scenarios": scenario_results,
        "regret_score": regret_score,
    }


def _compute_regret_score(
    req: SimulationRequest,
    buy_now_matrix: np.ndarray,
    goals: list[Goal],
) -> int:
    """
    Compute the integer regret score (0-100) for the buy_now scenario.

    Component A (0-50): Average goal delay
        50 * min(avg_delay_years, 1)
        null delays count as 12 months (1 year).

    Component B (0-25): Emergency fund erosion
        25 * (1 - clamp(savings_after_purchase / (3 * expenses), 0, 1))

    Component C (0-25): EMI burden
        25 * min((EMI / income) / 0.4, 1)
        If income == 0, component C = 25 (worst case).
    """
    income        = req.monthlyIncome
    base_expenses = req.monthlyExpenses
    savings       = req.savings
    purchase      = req.purchase

    # --- Component A: Average delay across all goals ---
    delay_values = []
    for gi, goal in enumerate(goals):
        col = buy_now_matrix[:, gi]
        reached_mask = col <= N_MONTHS

        full_col = col.copy()
        full_col[~reached_mask] = np.inf

        sorted_col = np.sort(full_col)
        mid = N_RUNS // 2
        m1, m2 = sorted_col[mid - 1], sorted_col[mid]

        if np.isinf(m1) or np.isinf(m2):
            delay_months_val = 12.0   # null counts as 12
        else:
            median_completion = (m1 + m2) / 2.0
            delay_months_val = max(0.0, median_completion - goal.targetMonths)

        delay_values.append(delay_months_val)

    avg_delay_months = float(np.mean(delay_values)) if delay_values else 0.0
    avg_delay_years  = avg_delay_months / 12.0
    comp_a = 50.0 * min(avg_delay_years, 1.0)

    # --- Component B: Emergency fund ---
    if purchase.mode == "full":
        savings_after = savings - purchase.price
    else:
        # For EMI, the upfront payment is 0 (no lump-sum deduction)
        savings_after = savings

    if base_expenses == 0:
        # Zero expenses → emergency fund ratio is undefined; treat as fully funded
        ratio_b = 1.0
    else:
        ratio_b = savings_after / (3.0 * base_expenses)

    ratio_b_clamped = max(0.0, min(ratio_b, 1.0))
    comp_b = 25.0 * (1.0 - ratio_b_clamped)

    # --- Component C: EMI burden ---
    if purchase.mode == "emi":
        emi_amount = _monthly_emi(purchase.price, purchase.interestRate, purchase.emiMonths)
    else:
        emi_amount = 0.0

    if income == 0:
        comp_c = 25.0
    else:
        comp_c = 25.0 * min((emi_amount / income) / 0.4, 1.0)

    total = comp_a + comp_b + comp_c
    return int(round(min(max(total, 0), 100)))
