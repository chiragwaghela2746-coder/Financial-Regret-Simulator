# Financial Regret Simulator

> **⚠️ Educational use only, not financial advice.**

A full-stack web app that shows how a purchase decision affects your savings goals using an AI-powered regret score.

---

## Features

- 🔐 **Auth** — Register & Login with JWT + bcrypt
- 👤 **Finance Profile** — Monthly income, expenses, current savings
- 🎯 **Goals** — CRUD savings goals with priority ordering
- 🔮 **Simulation** — Full payment or EMI; calls AI service (or mock)
- 📊 **Result** — Regret score gauge, Buy/Wait/Cheaper comparison, goal delay chart, on-time probability table
- 📅 **Feedback** — "Do you regret it?" (available 30 days post-simulation; immediate in DEMO_MODE)
- 🕒 **History** — Paginated simulation history with delete
- 💰 **INR formatting** throughout

---

## Tech Stack

| Layer    | Tech                                     |
|----------|------------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6, Recharts |
| Backend  | Node.js, Express, MongoDB, Mongoose, JWT, bcrypt |
| AI       | External service at `AI_URL/simulate` (mock available) |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB running locally on port 27017 (or set `MONGO_URI`)

### 1. Clone & navigate
```bash
git clone <repo-url>
cd <project>
```

### 2. Server setup
```bash
cd server
cp .env.example .env    # Edit values as needed
npm install
npm run dev             # Runs on http://localhost:5000
```

### 3. Client setup
```bash
cd client
cp .env.example .env    # Edit VITE_API_URL if needed
npm install
npm run dev             # Runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Environment Variables

### `/server/.env.example`
| Variable       | Default                                     | Description                        |
|----------------|---------------------------------------------|------------------------------------|
| `PORT`         | `5000`                                      | Express server port                |
| `MONGO_URI`    | `mongodb://localhost:27017/financial_regret_simulator` | MongoDB connection string |
| `JWT_SECRET`   | —                                           | Secret for signing JWTs (required) |
| `JWT_EXPIRES_IN` | `7d`                                      | JWT expiry                         |
| `AI_URL`       | `http://localhost:8000`                     | AI simulation service base URL     |
| `MOCK_AI`      | `true`                                      | `true` = use mock AI (no real service needed) |
| `DEMO_MODE`    | `true`                                      | `true` = feedback available immediately (not after 30 days) |
| `CLIENT_URL`   | `http://localhost:5173`                     | CORS origin                        |

### `/client/.env.example`
| Variable        | Default                      | Description             |
|-----------------|------------------------------|-------------------------|
| `VITE_API_URL`  | `http://localhost:5000/api`  | Backend API base URL    |

---

## API Contract (AI Service)

Per `API_CONTRACT.md`:

```
POST AI_URL/simulate

Request:
{
  monthlyIncome, monthlyExpenses, savings,
  goals: [{ name, amount, targetMonths }],
  purchase: { name, price, mode: "full"|"emi", emiMonths?, interestRate? }
}

Response:
{
  regretScore: 0-100,
  scenarios: [{ type: "buy_now"|"wait"|"cheaper", goals: [{ name, delayMonths: number|null, onTimeProbability: 0-1 }] }],
  explanation: string
}
```

- `delayMonths: null` = goal not reachable within 60 months
- `interestRate` = annual %; EMI fields required when `mode="emi"`

---

## Running Tests

```bash
cd server
npm test
```

Requires MongoDB on `localhost:27017`. Tests use a separate `frs_test_*` database that is dropped after the run.

---

## Project Structure

```
.
├── API_CONTRACT.md
├── .gitignore
├── README.md
├── client/
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── context/AuthContext.jsx
│       ├── services/api.js
│       ├── utils/helpers.js
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── LoadingSpinner.jsx
│       │   ├── ErrorAlert.jsx
│       │   └── EmptyState.jsx
│       └── pages/
│           ├── AuthPage.jsx
│           ├── DashboardPage.jsx
│           ├── ProfilePage.jsx
│           ├── GoalsPage.jsx
│           ├── NewPurchasePage.jsx
│           ├── ResultPage.jsx
│           └── HistoryPage.jsx
└── server/
    ├── .env.example
    ├── tests/api.test.js
    └── src/
        ├── index.js
        ├── config/db.js
        ├── middleware/
        │   ├── auth.js
        │   ├── errorHandler.js
        │   └── validate.js
        ├── models/
        │   ├── User.js
        │   ├── FinanceProfile.js
        │   ├── Goal.js
        │   └── Simulation.js
        ├── routes/
        │   ├── auth.js
        │   ├── profile.js
        │   ├── goals.js
        │   ├── simulations.js
        │   └── feedback.js
        └── services/
            └── aiService.js
```

---

## Notes

- `MOCK_AI=true` returns realistic dummy data — no external AI service needed to run locally.
- `DEMO_MODE=true` lets you submit feedback immediately without waiting 30 days.
- All monetary values are in **Indian Rupees (INR)**.
- Users can only access their own data (enforced server-side).
