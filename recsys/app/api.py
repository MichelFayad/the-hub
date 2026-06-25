"""FastAPI recsys microservice (scope §8 Phase 2+; build-plan Phase 4).

Serves recommendations from the hybrid model, trained at startup on the
synthetic dataset until real interaction volume justifies retraining on
live Hub data (see synthetic_data.py). Wiring this against the production
Postgres DB, a retraining schedule, and a live A/B test against the TS
rule-based engine is the deploy-time follow-up — per scope §8, that's an
infrastructure job for the engineering team, not a modeling job.

Run: uvicorn app.api:app --reload
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .hybrid_model import HybridModel
from .synthetic_data import SyntheticDataset, generate_dataset

app = FastAPI(title="The Hub — Recsys")


def _build_model() -> tuple[SyntheticDataset, HybridModel]:
    dataset = generate_dataset()
    return dataset, HybridModel(dataset=dataset)


_dataset, _model = _build_model()


class RecommendRequest(BaseModel):
    user_id: str
    k: int = 20


class RecommendResponse(BaseModel):
    location_ids: list[str]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    known_user_ids = {u.id for u in _dataset.users}
    if req.user_id not in known_user_ids:
        raise HTTPException(status_code=404, detail="unknown user_id")
    return RecommendResponse(location_ids=_model.recommend(req.user_id, req.k))
