from collections.abc import Iterator
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .schemas import MemoRequest, MemoResponse, SearchRequest, SearchResponse, SearchResult
from .service import build_search_result


app = FastAPI(title="GreenChain API")

search_results: dict[str, SearchResult] = {}
search_events: dict[str, list[str]] = {}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "GreenChain API"}


@app.get("/api/health")
def read_health() -> dict[str, str]:
    return {"status": "ok", "message": "FastAPI backend is running"}


@app.post("/api/search", response_model=SearchResponse)
def create_search(payload: SearchRequest) -> SearchResponse:
    search_id = str(uuid4())
    result = build_search_result(search_id=search_id, payload=payload)
    search_results[search_id] = result
    search_events[search_id] = [
        f"Searching manufacturers for {payload.product}...",
        f"Comparing countries: {', '.join(payload.countries)}",
        f"Checking certifications: {', '.join(payload.certifications) or 'none selected'}",
        f"Scoring transport via {payload.transport_mode.value} freight...",
        "Ranking candidate suppliers...",
        "Comparison ready.",
    ]
    return SearchResponse(search_id=search_id)


@app.get("/api/results/{search_id}", response_model=SearchResult)
def get_results(search_id: str) -> SearchResult:
    result = search_results.get(search_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Search not found")
    return result


@app.get("/api/stream/{search_id}")
def stream_results(search_id: str) -> StreamingResponse:
    messages = search_events.get(search_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Search not found")

    def event_stream() -> Iterator[str]:
        for message in messages:
            yield f"data: {message}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/memo", response_model=MemoResponse)
def create_memo(payload: MemoRequest) -> MemoResponse:
    result = search_results.get(payload.search_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Search not found")

    top_pick = result.results[0]
    body = (
        f"{top_pick.manufacturer_name} in {top_pick.country} ranks first in the current "
        f"comparison, combining lower manufacturing and transport scores than the other "
        f"options. Use this supplier as the recommended baseline, validate its published "
        f"sustainability disclosures, and confirm transport assumptions before procurement."
    )
    return MemoResponse(
        title=f"Recommendation for {result.summary}",
        body=body,
    )
