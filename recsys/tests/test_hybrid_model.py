from app.hybrid_model import HybridModel
from app.synthetic_data import generate_dataset


def test_recommend_returns_k_known_location_ids():
    ds = generate_dataset(n_locations=50, n_users=20, seed=5)
    model = HybridModel(dataset=ds)
    location_ids = {l.id for l in ds.locations}
    result = model.recommend(ds.users[0].id, k=10)
    assert len(result) == 10
    assert all(loc_id in location_ids for loc_id in result)
    assert len(set(result)) == len(result)  # no duplicates


def test_unknown_user_returns_empty():
    ds = generate_dataset(n_locations=20, n_users=5, seed=2)
    model = HybridModel(dataset=ds)
    assert model.recommend("does-not-exist", k=5) == []


def test_recommendations_skew_toward_a_users_interest_category():
    ds = generate_dataset(n_categories=6, n_locations=300, n_users=50, seed=8)
    model = HybridModel(dataset=ds)
    user = ds.users[0]
    result = model.recommend(user.id, k=20)
    matched = sum(
        1
        for loc_id in result
        for loc in ds.locations
        if loc.id == loc_id and loc.category_id in user.interest_category_ids
    )
    # not every top-20 needs to match, but the model should skew well above
    # chance (interest is typically 1-3 of 6 categories)
    assert matched >= 4
