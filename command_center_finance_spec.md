# Command Center — Personal Finance Module: Claude Code Build Spec

> Paste this whole file into Claude Code as the build brief. Build in the order given. Do not skip the "Canonical Money Model" section — it is the spine of the app.

---

## 0. Context

Add a **personal finance module** to my existing Flask "Command Center" app. It must mount as a self-contained blueprint at `/finance` and not break existing routes.

**Stack (do not substitute):** Flask, SQLAlchemy, Flask-Migrate (Alembic), WTForms (Flask-WTF), Bootstrap 5, Chart.js, SQLite for dev.

**Non-negotiables:**
- Mobile-first, modern SaaS dashboard aesthetic.
- One canonical money calculation used everywhere (no per-template math).
- A **Reset** feature that wipes data and restores the exact baseline seed state.
- Production-ready: input validation, DB transactions, idempotent generators, no double-counting.

---

## 1. Canonical Money Model (READ FIRST — this is the whole point)

The naive formula double-counts. If `Cash` is a live balance, expenses already reduced it, so subtracting them again is wrong. We fix this with an **anchor**.

**Settings hold one anchor:**
- `opening_balance` — the user's real cash on hand at a moment in time.
- `anchor_date` — the date that balance was true.

Everything is projected forward from the anchor, so each flow is counted exactly once.

**The single source of truth — implement once in `finance/services/balances.py`:**

```python
def compute_dashboard(today=None, horizon_days=None):
    today = today or date.today()
    s = Settings.get()
    horizon_days = horizon_days or s.future_income_horizon_days  # default 30
    horizon = today + timedelta(days=horizon_days)

    # Cash actually in hand right now = anchor + everything that has hit the account since
    received_income   = sum_income(received=True, after=s.anchor_date, until=today)
    expenses_to_date  = sum_expenses(after=s.anchor_date, until=today)
    bills_paid_amt    = sum_bill_instances(paid=True, after=s.anchor_date, until=today)
    current_cash = s.opening_balance + received_income - expenses_to_date - bills_paid_amt

    # Forward-looking
    future_income   = sum_income(received=False, until=horizon)        # paycheques not yet in the account
    unpaid_bills     = sum_bill_instances(paid=False, until=horizon)    # obligations still owed
    reserved_savings = reserve_pool_balance() + total_in_goals()       # money set aside, not free

    available_to_spend = current_cash + future_income - unpaid_bills - reserved_savings

    return {
        "current_cash": current_cash,
        "future_income": future_income,
        "bills_remaining": unpaid_bills,
        "reserved_savings": reserved_savings,
        "available_to_spend": available_to_spend,
    }
```

**Rules that keep it consistent (enforce in services, not templates):**
- An expense or a bill marked **paid** reduces `current_cash`. It is NEVER also subtracted from `available_to_spend` a second time.
- Income has a `received` flag. Unreceived = future income (added forward). Received = already folded into `current_cash`.
- `reserve_pool_balance() = Σ(income.savings_reserved) − Σ(allocations sourced from pool)`.
- Allocating to a goal MOVES money pool→goal (pool down, goal up). Net reserved is unchanged → no double count.
- All money fields are stored as integer **cents** (avoid float drift). Format to currency only at the view layer. Currency = CAD.

---

## 2. Project Structure

```
finance/
  __init__.py            # blueprint factory
  models.py
  forms.py
  routes/
    dashboard.py  income.py  bills.py  expenses.py
    savings.py  debt.py  analytics.py  admin.py
  services/
    balances.py          # compute_dashboard + all sum_* helpers
    bills.py             # idempotent instance generation
    seed.py              # seed_defaults() + reset functions
  templates/finance/...
  static/finance/...
migrations/              # Flask-Migrate
```

Register with `app.register_blueprint(finance_bp, url_prefix="/finance")`. Use the app-factory pattern if the existing app supports it; otherwise import the shared `db`.

---

## 3. Data Models (`models.py`)

All money = `Integer` cents. All tables prefixed conceptually as finance, with `created_at` defaults.

**Settings** (single row, accessed via `Settings.get()`):
`id, opening_balance, anchor_date, savings_percentage (default 20), future_income_horizon_days (default 30), currency (default "CAD")`

**Category:** `id, name, kind ("expense"|"income"), color (hex), icon, is_default (bool)`

**Income:** `id, amount, pay_date, source, notes, savings_reserved, received (bool, default False), created_at`
- On insert, compute `savings_reserved = round(amount * savings_percentage / 100)` and push that into the reserve pool.

**RecurringBill** (definition): `id, name, amount, category_id, due_day (1–31), autopay (bool), active (bool), created_at`

**BillInstance** (generated occurrence): `id, recurring_bill_id (nullable → one-off bills allowed), name, amount, due_date, paid (bool), paid_date, created_at`
- **Unique constraint** `(recurring_bill_id, due_date)` so regeneration is idempotent.

**Expense:** `id, amount, date, category_id, description, created_at`

**SavingsGoal:** `id, name, target_amount, current_amount (default 0), target_date, color, created_at`

**SavingsAllocation:** `id, goal_id, amount, date, source ("pool"|"manual")`

**Debt:** `id, name, kind ("credit_card"|"loan"), original_balance, current_balance, apr, minimum_payment, due_day, created_at`

**DebtPayment:** `id, debt_id, amount, date, principal, interest`

**Recent Transactions** is a *derived union* of Income (received), Expenses, and paid BillInstances ordered by date desc — do NOT create a separate transactions table (single source of truth).

---

## 4. Migrations

Use Flask-Migrate. Provide:
- `flask db init` (if not already), `flask db migrate -m "finance module"`, `flask db upgrade`.
- A `flask seed-finance` CLI command that calls `seed_defaults()`.

---

## 5. Routes / Endpoints

Each as a list view + create/edit/delete. JSON endpoints feed Chart.js.

| Area | Routes |
|---|---|
| Dashboard | `GET /finance/` → renders KPIs from `compute_dashboard()`, upcoming bills, recent transactions |
| Income | `GET/POST /finance/income`, `POST /finance/income/<id>/receive`, `delete` |
| Bills | `GET/POST /finance/bills` (definitions), `POST /finance/bills/generate`, `POST /finance/bills/instance/<id>/pay`, `unpay`, `delete` |
| Expenses | `GET/POST /finance/expenses` with `?q=&category=&from=&to=` search/filter |
| Savings | `GET/POST /finance/savings`, `POST /finance/savings/<id>/allocate` |
| Debt | `GET/POST /finance/debt`, `POST /finance/debt/<id>/payment` |
| Analytics | `GET /finance/analytics` + JSON: `/api/spending-by-category`, `/api/monthly-trend`, `/api/savings-rate`, `/api/debt-progress` |
| Admin | `GET /finance/admin`, `POST /finance/admin/reset` |

Wrap every multi-write action (pay bill, allocate, record payment, reset) in a single DB transaction with rollback on error.

---

## 6. Bill Generation (`services/bills.py`) — idempotent

```python
def generate_bill_instances(target_month: date):
    for bill in RecurringBill.query.filter_by(active=True):
        due = safe_day(target_month.year, target_month.month, bill.due_day)  # clamp 31→last day
        exists = BillInstance.query.filter_by(recurring_bill_id=bill.id, due_date=due).first()
        if not exists:
            db.session.add(BillInstance(recurring_bill_id=bill.id, name=bill.name,
                                        amount=bill.amount, due_date=due, paid=False))
    db.session.commit()
```
Call on dashboard load for the current month, and expose a manual "Generate this month's bills" button. The unique constraint makes repeat calls safe.

**States:** `overdue` = unpaid AND `due_date < today`; `due_soon` = unpaid AND `today ≤ due_date ≤ today+7`. Badge them red / amber.

---

## 7. Forms (`forms.py`, Flask-WTF)

WTForms for: IncomeForm, RecurringBillForm, ExpenseForm, SavingsGoalForm, AllocationForm, DebtForm, DebtPaymentForm, SettingsForm, ResetForm. Validate: amounts > 0, dates valid, due_day 1–31, percentage 0–100, CSRF on every POST. Convert dollar inputs → cents on load, cents → dollars on render.

---

## 8. UI / Templates (Bootstrap 5, mobile-first)

- Base layout with a collapsible sidebar (off-canvas on mobile) and a sticky top bar showing the live **Available To Spend** number — large, bold, color-coded (green positive / red negative).
- Dashboard: responsive KPI cards (Current Cash, Available To Spend, Bills Remaining, Savings Reserved) in a `row-cols-1 row-cols-md-2 row-cols-xl-4` grid; below them Upcoming Bills list and Recent Transactions list.
- Cards: soft shadows, rounded-3, generous padding, muted labels + large figures. Use a restrained accent palette and system font stack for the SaaS feel.
- Progress bars for savings goals (`current/target`) and debt (`(original−current)/original`).
- All tables become stacked cards under `sm`. Forms in Bootstrap modals where it tightens the flow.

---

## 9. Analytics (Chart.js)

- **Spending by category** — doughnut, current month, from `/api/spending-by-category`.
- **Monthly spending trend** — line, last 6 months.
- **Savings rate** — `Σ savings_reserved / Σ income` for the period, shown as a stat + small trend line.
- **Debt payoff progress** — stacked/horizontal bar per debt (paid vs remaining).

Fetch JSON via `fetch()`, render on `DOMContentLoaded`, destroy/rebuild charts on filter change.

---

## 10. The Reset Feature ("erase data, put it all back the same")

This is a hard requirement. Implement in `services/seed.py`, two modes, both atomic and both behind a typed confirmation (`ResetForm` requires the user to type `RESET`).

```python
def seed_defaults():
    """Idempotent. Creates Settings row (if missing) + default categories."""
    if not Settings.query.first():
        db.session.add(Settings(opening_balance=0, anchor_date=date.today(),
                                 savings_percentage=20, future_income_horizon_days=30,
                                 currency="CAD"))
    for c in DEFAULT_CATEGORIES:            # e.g. Groceries, Rent, Transport, Dining, Utilities, Fun...
        if not Category.query.filter_by(name=c["name"]).first():
            db.session.add(Category(**c, is_default=True))
    db.session.commit()

def soft_reset():
    """Clear all activity, KEEP definitions, reset their dynamic fields to baseline."""
    with db.session.begin_nested():
        Income.query.delete(); Expense.query.delete()
        BillInstance.query.delete(); SavingsAllocation.query.delete()
        DebtPayment.query.delete()
        for g in SavingsGoal.query: g.current_amount = 0
        for d in Debt.query: d.current_balance = d.original_balance
    db.session.commit()

def factory_reset():
    """Full wipe → reseed. Restores the exact fresh-install baseline."""
    with db.session.begin_nested():
        for model in (DebtPayment, Debt, SavingsAllocation, SavingsGoal,
                      Expense, BillInstance, RecurringBill, Income,
                      Category, Settings):
            model.query.delete()
    seed_defaults()
    db.session.commit()
```

Admin page offers both buttons with a clear warning. After reset, redirect to dashboard — which now reads identically to a fresh install because `seed_defaults()` rebuilt the baseline.

---

## 11. Build Order (do these in sequence, commit after each)

1. Models + migration + `seed_defaults()` + `flask seed-finance`.
2. `services/balances.py` with `compute_dashboard()` and all `sum_*` helpers.
3. Dashboard route + base layout + KPI cards (prove the number is right before anything else).
4. Income (with auto-reserve) → confirm reserve pool moves the dashboard correctly.
5. Recurring bills + idempotent generation + pay/unpay + due/overdue states.
6. Expenses + search/filter.
7. Savings goals + allocation (pool→goal).
8. Debt + payments.
9. Analytics JSON endpoints + Chart.js.
10. Admin reset (soft + factory).
11. Polish responsive UI.

---

## 12. Acceptance Criteria (verify before calling it done)

- Logging an expense lowers **Current Cash** and **Available To Spend** by the same amount **once** — never twice.
- Marking a bill paid moves its amount from "Bills Remaining" into reduced cash, with no net error in Available To Spend.
- Adding a $1000 paycheque at 20% reserve raises reserved savings by $200 and future income by $1000 (until received).
- Running bill generation twice in a row creates no duplicates.
- Factory reset returns the dashboard to byte-for-byte the same baseline as first install.
- Every money figure renders as CAD currency; storage is integer cents throughout.
- Works cleanly at 375px width.

---

## 13. Guardrails

- No floats for money. No math in templates. CSRF on all POSTs. Server-side validation on every form. Atomic transactions with rollback. Idempotent generators. Keep the finance blueprint isolated so it can't break existing Command Center routes.
