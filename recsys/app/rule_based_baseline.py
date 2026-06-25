"""Python mirror of src/services/preferences.ts `recommendForUser` (scope
§8 launch step), operating on the synthetic dataset so the eval harness
can A/B the ML hybrid against the exact rule-based logic that's live in
production: category match -> budget filter -> rating-ranked, with a
cold-start fallback to top-rated overall when nothing matches.
"""

from __future__ import annotations

from .synthetic_data import SyntheticDataset, User


def recommend_rule_based(dataset: SyntheticDataset, user: User, k: int = 20) -> list[str]:
    candidates = dataset.locations

    matched = [loc for loc in candidates if loc.category_id in user.interest_category_ids]
    pool = matched if matched else candidates  # cold start / no-match fallback

    if user.budget_max is not None:
        in_budget = [loc for loc in pool if loc.price_level <= user.budget_max]
        pool = in_budget if in_budget else pool

    ranked = sorted(pool, key=lambda loc: loc.rating_avg, reverse=True)
    return [loc.id for loc in ranked[:k]]
