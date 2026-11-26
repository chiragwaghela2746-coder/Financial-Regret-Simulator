"""
Template-based explanation generator.
No LLM — only calculated values from simulation results.
"""
from __future__ import annotations

from typing import Optional


def _fmt_inr(amount: float) -> str:
    """Format a number as ₹ with commas (Indian style, no decimals)."""
    return f"₹{int(amount):,}"


def _delay_str(delay: Optional[int]) -> str:
    if delay is None:
        return "not reaching it within 5 years"
    if delay == 0:
        return "on track"
    unit = "month" if delay == 1 else "months"
    return f"delayed by {delay} {unit}"


def build_explanation(
    *,
    purchase_name: str,
    purchase_price: float,
    regret_score: int,
    buy_now_goals: list[dict],
    wait_goals: list[dict],
    cheaper_goals: list[dict],
    monthly_income: float,
    monthly_expenses: float,
    savings: float,
) -> str:
    """
    Produce a human-readable explanation string from simulation outputs only.
    """
    lines: list[str] = []

    # --- Opening ---
    if regret_score >= 75:
        sentiment = "a high-regret purchase"
    elif regret_score >= 50:
        sentiment = "a moderate-regret purchase"
    elif regret_score >= 25:
        sentiment = "a low-regret purchase"
    else:
        sentiment = "a minimal-regret purchase"

    lines.append(
        f"Buying {purchase_name} ({_fmt_inr(purchase_price)}) scores {regret_score}/100 — {sentiment}."
    )

    # --- buy_now goal impact ---
    if buy_now_goals:
        goal_summaries = []
        for g in buy_now_goals:
            goal_summaries.append(f"{g['name']} ({_delay_str(g['delayMonths'])})")
        lines.append(f"If you buy now, your financial goals would be: {', '.join(goal_summaries)}.")

        # on-time probabilities
        prob_parts = []
        for g in buy_now_goals:
            pct = int(round(g["onTimeProbability"] * 100))
            prob_parts.append(f"{g['name']}: {pct}% chance on time")
        lines.append("On-time probabilities — " + "; ".join(prob_parts) + ".")

    # --- wait scenario comparison ---
    wait_better = []
    for bn, wt in zip(buy_now_goals, wait_goals):
        if wt["delayMonths"] is not None and bn["delayMonths"] is not None:
            if wt["delayMonths"] < bn["delayMonths"]:
                diff = bn["delayMonths"] - wt["delayMonths"]
                wait_better.append(f"{bn['name']} by {diff} month{'s' if diff != 1 else ''}")
        elif wt["delayMonths"] is None and bn["delayMonths"] is not None:
            pass   # wait is worse; skip
        elif wt["delayMonths"] is not None and bn["delayMonths"] is None:
            wait_better.append(f"{bn['name']} (you would actually reach it)")

    if wait_better:
        lines.append(
            f"Waiting 3 months before buying improves goal outcomes for: {', '.join(wait_better)}."
        )
    else:
        lines.append("Waiting 3 months before buying does not significantly change goal outcomes.")

    # --- cheaper alternative ---
    cheaper_price = purchase_price * 0.7
    cheaper_better = []
    for bn, ch in zip(buy_now_goals, cheaper_goals):
        if ch["delayMonths"] is not None and bn["delayMonths"] is not None:
            if ch["delayMonths"] < bn["delayMonths"]:
                diff = bn["delayMonths"] - ch["delayMonths"]
                cheaper_better.append(f"{bn['name']} by {diff} month{'s' if diff != 1 else ''}")
        elif ch["delayMonths"] is not None and bn["delayMonths"] is None:
            cheaper_better.append(f"{bn['name']} (reachable with cheaper option)")

    if cheaper_better:
        lines.append(
            f"A cheaper alternative at {_fmt_inr(cheaper_price)} (70% of price) would improve: {', '.join(cheaper_better)}."
        )
    else:
        lines.append(
            f"A cheaper alternative at {_fmt_inr(cheaper_price)} (70% of price) offers similar goal outcomes."
        )

    # --- Emergency fund note ---
    if monthly_expenses > 0:
        cushion_months = savings / monthly_expenses
        lines.append(
            f"Your current savings of {_fmt_inr(savings)} cover approximately "
            f"{cushion_months:.1f} months of expenses."
        )

    # --- Closing recommendation ---
    if regret_score >= 75:
        lines.append(
            "Consider waiting or choosing a more affordable option to protect your financial goals."
        )
    elif regret_score >= 50:
        lines.append(
            "Proceed with caution — this purchase puts some financial goals at risk."
        )
    elif regret_score >= 25:
        lines.append(
            "This purchase has a modest impact on your savings goals."
        )
    else:
        lines.append(
            "This purchase is well within your financial comfort zone."
        )

    return " ".join(lines)
