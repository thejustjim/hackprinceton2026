# GreenChain

Environmental supply chain comparator. Submit a product + source countries + transport mode; get a ranked list of real manufacturers scored across multiple environmental dimensions (manufacturing emissions, transport CO2, grid carbon, certifications, climate risk).

## Structure

```text
frontend/   Next.js dashboard (globe view, supply chain graph, prompt bar)
backend/    FastAPI + Dedalus agent + XGBoost ML scoring
            └── ml_runtime/   Vendored XGBoost models + reference data (~9 MB)
```

## Backend setup

```bash
cd backend
cp .env.example .env       # then fill in your API keys
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # includes `dedalus-labs` — required for `import dedalus_labs`
cd ..                      # run uvicorn from repo root so the `backend.*` package resolves
uvicorn backend.main:app --reload --port 8000
```

If you see **`No module named 'dedalus_labs'`**, the API process is using a Python environment where dependencies were not installed (e.g. system Python vs `.venv`). Activate `backend/.venv`, re-run `pip install -r requirements.txt`, and start **uvicorn from that same shell** (or point your IDE’s interpreter to `backend/.venv`).

Open `http://localhost:8000/docs` for the interactive Swagger UI.

### Required keys (in `backend/.env`)

| Key | Where to get it |
|-----|-----------------|
| `DEDALUS_API_KEY` | https://dedaluslabs.ai |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `BRAVE_API_KEY` | https://api.search.brave.com/app/keys (free tier: 2k queries/month) |

If `/search` with `components` returns **502** or the dashboard shows a search error, read the `detail` message: it is usually a missing key or a Dedalus/network failure. The backend previously substituted **mock** manufacturers on any agent error (making failures look like “success”). That mock path is now **off by default**; set `GREENCHAIN_ALLOW_MOCK_COMPONENT_SEARCH=1` in `backend/.env` only when you intentionally want fake results without API keys.

On startup, the backend prints warnings when `BRAVE_API_KEY` or Dedalus/Anthropic keys are missing.

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and calls the backend at `http://localhost:8000`.

## Backend API

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/health`            | Liveness probe |
| POST   | `/search`            | Run Dedalus agent + ML scoring, return ranked manufacturers |
| POST   | `/score`             | Score pre-collected candidates (skip the agent call) |
| POST   | `/rescore-transport` | Recompute transport emissions under a different mode |

### Example request

```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{
    "product": "cotton t-shirts",
    "quantity": 10000,
    "destination": "US",
    "countries": ["CN", "PT", "BD"],
    "transport_mode": "sea",
    "target_count": 9
  }'
```

Two modes:
- **Per-country:** pass a non-empty `countries` array. Agent finds manufacturers in each.
- **Global:** pass `countries: []`. Agent picks countries itself, biased toward geographic diversity.

## ML pipeline

- **Manufacturing emissions:** XGBoost quantile regression (q10/q50/q90) trained on USEEIO v1.3 (1,016 NAICS codes), Ember Climate (179 countries grid carbon), ND-GAIN (167 countries climate risk).
- **Transport emissions:** GLEC framework factors × shipment weight × port-distance lookup.
- **Composite score:** Normalised 0-100 across 5 dimensions with adjustable weights.

Models live under `backend/ml_runtime/models/` and are loaded once at FastAPI startup.

## Sponsor track

Built for HackPrinceton Spring 2026, **"Best agent swarm hosted on Dedalus Containers"** (Dedalus track).
