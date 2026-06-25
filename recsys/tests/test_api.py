from fastapi.testclient import TestClient

from app.api import _dataset, app

client = TestClient(app)


def test_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_recommend_known_user():
    user_id = _dataset.users[0].id
    resp = client.post("/recommend", json={"user_id": user_id, "k": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["location_ids"]) == 5


def test_recommend_unknown_user_404():
    resp = client.post("/recommend", json={"user_id": "nope", "k": 5})
    assert resp.status_code == 404
