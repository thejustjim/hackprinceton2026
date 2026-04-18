# GreenChain

Starter scaffold aligned to the HackPrinceton brief: a React + TypeScript frontend and a FastAPI backend that already match the product's core workflow.

## Structure

```text
frontend/   Vite + React + TypeScript UI scaffold
backend/    FastAPI API scaffold with mock search/results/memo routes
```

## What is scaffolded

- Search form for product, quantity, destination, countries, transport mode, and certification filters
- Live status feed wired to a Server-Sent Events endpoint
- Supply chain graph panel placeholder for the D3 view
- World map panel placeholder for the Leaflet view
- Ranked results panel and recommendation memo hook
- FastAPI routes for `/api/search`, `/api/results/{id}`, `/api/stream/{id}`, and `/api/memo`

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

If needed, point it at a different API:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000`.

## Current API

- `GET /api/health`
- `POST /api/search`
- `GET /api/results/{search_id}`
- `GET /api/stream/{search_id}`
- `POST /api/memo`

## Next build steps

1. Replace mock backend scoring in `backend/app/service.py` with real agent, lookup-table, and model pipelines.
2. Swap the graph and map placeholders for D3 and React-Leaflet implementations.
3. Add SQLite caching and a real PDF export path for the memo flow.
