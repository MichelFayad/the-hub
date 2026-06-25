from app.synthetic_data import generate_dataset


def test_generates_requested_counts():
    ds = generate_dataset(n_categories=5, n_locations=20, n_users=10, seed=1)
    assert len(ds.categories) == 5
    assert len(ds.locations) == 20
    assert len(ds.users) == 10


def test_deterministic_for_a_fixed_seed():
    a = generate_dataset(n_locations=30, n_users=15, seed=99)
    b = generate_dataset(n_locations=30, n_users=15, seed=99)
    assert [i.location_id for i in a.interactions] == [i.location_id for i in b.interactions]


def test_interactions_reference_real_users_and_locations():
    ds = generate_dataset(n_locations=30, n_users=15, seed=3)
    user_ids = {u.id for u in ds.users}
    location_ids = {l.id for l in ds.locations}
    assert len(ds.interactions) > 0
    for interaction in ds.interactions:
        assert interaction.user_id in user_ids
        assert interaction.location_id in location_ids
        assert interaction.weight > 0


def test_category_matched_locations_get_more_interactions_than_unmatched():
    ds = generate_dataset(n_categories=4, n_locations=200, n_users=80, seed=11)
    matched_hits = 0
    unmatched_hits = 0
    for interaction in ds.interactions:
        user = next(u for u in ds.users if u.id == interaction.user_id)
        loc = next(l for l in ds.locations if l.id == interaction.location_id)
        if loc.category_id in user.interest_category_ids:
            matched_hits += 1
        else:
            unmatched_hits += 1
    assert matched_hits > unmatched_hits
