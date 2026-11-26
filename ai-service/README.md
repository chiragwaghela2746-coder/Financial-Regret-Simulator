# Financial Regret Simulator — AI Service

A **FastAPI** micro-service that runs 1 000 Monte Carlo simulations to quantify how a planned purchase affects your savings goals, then returns a regret score, per-scenario goal impact, and a plain-English explanation.

---

## Quick Start

```bash
# 1. Enter the ai-service directory
cd ai-service

# 2. Create and activate a virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) Copy and edit the env file for a fixed random seed
copy .env.example .env     # Windows
# cp .env.example .env     # macOS / Linux

# 5. Start the server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The service is now live at **http://localhost:8000**.

---

## Endpoints

| Method | Path        | Description                          |
|--------|-------------|--------------------------------------|
| GET    | `/health`   | Liveness probe → `{"status":"ok"}`  |
| POST   | `/simulate` | Run the regret simulation            |
| GET    | `/docs`     | Interactive Swagger UI               |
| GET    | `/redoc`    | ReDoc documentation                  |

---

## Request Schema

```jsonc
POST /simulate
Content-Type: application/json

{
  "monthlyIncome":   80000,      // ₹ — must be ≥ 0
  "monthlyExpenses": 30000,      // ₹ — must be ≥ 0
  "savings":         200000,     // ₹ — current liquid savings, ≥ 0
  "goals": [                     // at least 1 goal required
    {
      "name":         "Emergency Fund",
      "amount":       100000,    // ₹ — target amount, > 0
      "targetMonths": 6          // months by which you want it funded, > 0
    }
  ],
  "purchase": {
    "name":         "Laptop",
    "price":        80000,       // ₹ > 0
    "mode":         "full",      // "full" | "emi"
    // EMI-only fields (required when mode = "emi"):
    "emiMonths":    12,          // > 0
    "interestRate": 14.0         // annual %, ≥ 0  (0 = no-cost EMI)
  }
}
```

**Validation rules (422 on failure):**
- All monetary amounts and months must be non-negative (income, expenses, savings ≥ 0).
- `goals` must have at least one entry; each `amount > 0`, `targetMonths > 0`.
- `purchase.price > 0`.
- When `mode = "emi"`: `emiMonths > 0` and `interestRate ≥ 0` are both required.

---

## Response Schema

```jsonc
{
  "regretScore": 42,            // integer 0-100 (buy_now scenario only)
  "scenarios": [
    {
      "type": "buy_now",        // | "wait" | "cheaper"
      "goals": [
        {
          "name": "Emergency Fund",
          "delayMonths": 2,     // null = goal not reached within 60 months
          "onTimeProbability": 0.74  // share of runs finishing by targetMonths
        }
      ]
    }
    // ... wait and cheaper scenarios follow
  ],
  "explanation": "Buying Laptop (₹80,000) scores 42/100 — a moderate-regret purchase. ..."
}
```

---

## Sample Request

```bash
curl -X POST http://localhost:8000/simulate \
  -H "Content-Type: application/json" \
  -d @sample_request.json
```

---

## Running Tests

```bash
# From the ai-service directory, with the venv active:
pytest -v
```

All 25 tests should pass in under 10 seconds.

---

## Environment Variables

| Variable | Default | Description                                      |
|----------|---------|--------------------------------------------------|
| `SEED`   | *(none)*| Integer seed for NumPy RNG. Set for reproducible results; omit for random. |

---

## Project Structure

```
ai-service/
├── main.py              # FastAPI app, route handlers
├── models.py            # Pydantic request / response models
├── simulation.py        # Monte Carlo engine + regret score
├── explanation.py       # Template-based explanation generator
├── tests/
│   ├── conftest.py
│   └── test_simulation.py   # 25 pytest tests
├── requirements.txt
├── pytest.ini
├── .env.example
├── .gitignore
├── sample_request.json
└── README.md
```

---

## Simulation Assumptions

1. **Horizon & runs**: 1 000 independent Monte Carlo runs, each simulating 60 months.
2. **Shared randomness**: All three scenarios (buy\_now, wait, cheaper) use the **same** random draws per run; differences reflect only the purchase decision.
3. **Income**: Treated as fixed each month (no variability modelled).
4. **Expense variation**: Each month's expenses are drawn from `Uniform(0.9 × base, 1.1 × base)` (±10 %).
5. **Surprise costs**: 5 % chance each month of an unexpected expense drawn from `Uniform(25 %, 100 %)` of base monthly expenses.
6. **Goal funding**: Goals are evaluated in listing order. A goal is funded the first month the running balance (after all deductions) covers the full amount.
7. **Shortfall**: A full-price purchase that exceeds the available balance results in a negative balance; future income gradually restores it.
8. **EMI formula**: Standard loan amortisation. At 0 % interest, EMI = `price / emiMonths`.
9. **EMI timing**: The first EMI instalment is deducted in the same month the purchase is made.
10. **Scenarios**:
    - `buy_now` — purchase in month 1 at full price.
    - `wait` — purchase in month 4 at full price (3-month delay).
    - `cheaper` — purchase in month 1 at 70 % of price.
11. **`delayMonths`**: `max(0, median(completion month) − targetMonths)`. Runs where the goal is never reached contribute +∞ to the median. If the median is +∞ (more than half the runs never complete), `delayMonths` is `null`.
12. **`onTimeProbability`**: Fraction of runs in which the goal is funded on or before `targetMonths`.
13. **Regret score components** (buy\_now only, integer 0–100):
    - **A (0–50)**: `50 × min(avg_goal_delay_in_years, 1)` — `null` delay counts as 12 months.
    - **B (0–25)**: Emergency fund erosion — `25 × (1 − clamp(savings_after_purchase / (3 × expenses), 0, 1))`. Zero expenses → component B = 0.
    - **C (0–25)**: EMI burden — `25 × min((EMI / income) / 0.4, 1)`. Zero income → component C = 25 (worst case).
14. **Explanation**: Entirely template-based — no LLM calls.
15. **Currency**: All amounts are in Indian Rupees (₹). No currency conversion is performed.
