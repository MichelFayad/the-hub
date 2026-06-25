"""Hybrid recommender (scope §8 phase 2+): content-based filtering on
profile/category data, blended with collaborative filtering via
TruncatedSVD over the implicit user-item interaction matrix.

`implicit`/LightFM were considered (per scope §8) but need compiled C
extensions that don't reliably build cross-platform; scikit-learn's
TruncatedSVD covers the same "find latent taste dimensions from implicit
feedback" idea without that dependency risk.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.decomposition import TruncatedSVD

from .synthetic_data import Location, SyntheticDataset, User


def _content_score(user: User, location: Location) -> float:
    score = 0.0
    if location.category_id in user.interest_category_ids:
        score += 1.0
    if user.budget_max is None or location.price_level <= user.budget_max:
        score += 0.4
    score += (location.rating_avg - 1) / 4 * 0.4
    return score


def _normalize(values: np.ndarray) -> np.ndarray:
    lo, hi = values.min(), values.max()
    if hi > lo:
        return (values - lo) / (hi - lo)
    return np.zeros_like(values)


@dataclass
class HybridModel:
    dataset: SyntheticDataset
    n_factors: int = 16
    content_weight: float = 0.5
    collab_weight: float = 0.5

    _user_index: dict[str, int] = field(default_factory=dict, repr=False)
    _location_index: dict[str, int] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self._user_index = {u.id: i for i, u in enumerate(self.dataset.users)}
        self._location_index = {l.id: i for i, l in enumerate(self.dataset.locations)}

        rows, cols, vals = [], [], []
        for interaction in self.dataset.interactions:
            ui = self._user_index.get(interaction.user_id)
            li = self._location_index.get(interaction.location_id)
            if ui is None or li is None:
                continue
            rows.append(ui)
            cols.append(li)
            vals.append(interaction.weight)

        matrix = csr_matrix(
            (vals, (rows, cols)),
            shape=(len(self.dataset.users), len(self.dataset.locations)),
        )
        n_factors = min(self.n_factors, max(1, min(matrix.shape) - 1))
        self._svd = TruncatedSVD(n_components=n_factors, random_state=42)
        self._user_factors = self._svd.fit_transform(matrix)
        self._item_factors = self._svd.components_.T  # (n_locations, n_factors)

    def _collab_scores(self, user_id: str) -> np.ndarray:
        ui = self._user_index.get(user_id)
        if ui is None:
            return np.zeros(len(self.dataset.locations))
        return self._item_factors @ self._user_factors[ui]

    def recommend(self, user_id: str, k: int = 20) -> list[str]:
        user = next((u for u in self.dataset.users if u.id == user_id), None)
        if user is None:
            return []

        collab = _normalize(self._collab_scores(user_id))
        content = _normalize(
            np.array([_content_score(user, loc) for loc in self.dataset.locations])
        )
        blended = self.content_weight * content + self.collab_weight * collab

        order = np.argsort(-blended)[:k]
        return [self.dataset.locations[i].id for i in order]
