from app.rule_based_baseline import recommend_rule_based
from app.synthetic_data import Category, Location, SyntheticDataset, User


def make_dataset():
    categories = [Category(id="c1", name="C1"), Category(id="c2", name="C2")]
    locations = [
        Location(id="l1", name="L1", category_id="c1", price_level=1, rating_avg=4.5),
        Location(id="l2", name="L2", category_id="c1", price_level=4, rating_avg=4.9),
        Location(id="l3", name="L3", category_id="c2", price_level=2, rating_avg=3.0),
    ]
    return SyntheticDataset(categories=categories, locations=locations, users=[], interactions=[])


def test_matches_category_and_ranks_by_rating():
    ds = make_dataset()
    user = User(id="u1", interest_category_ids=("c1",), budget_max=None)
    result = recommend_rule_based(ds, user, k=10)
    assert result == ["l2", "l1"]


def test_filters_by_budget_within_matched_category():
    ds = make_dataset()
    user = User(id="u1", interest_category_ids=("c1",), budget_max=2)
    result = recommend_rule_based(ds, user, k=10)
    assert result == ["l1"]


def test_falls_back_to_full_pool_on_no_category_match():
    ds = make_dataset()
    user = User(id="u1", interest_category_ids=("c99",), budget_max=None)
    result = recommend_rule_based(ds, user, k=10)
    assert set(result) == {"l1", "l2", "l3"}
    assert result[0] == "l2"  # still rating-ranked


def test_respects_k():
    ds = make_dataset()
    user = User(id="u1", interest_category_ids=("c1", "c2"), budget_max=None)
    result = recommend_rule_based(ds, user, k=1)
    assert result == ["l2"]
