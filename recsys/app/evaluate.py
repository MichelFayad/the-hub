"""Offline evaluation harness (scope §8 "evaluation script"; build-plan
Phase 4 "A/B test vs rule-based baseline"). Splits each user's synthetic
interactions into train/test, fits the hybrid model on the train split
only, and reports Precision@K / Recall@K for both the hybrid model and
the rule-based baseline against the same held-out test interactions.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Callable

from .hybrid_model import HybridModel
from .rule_based_baseline import recommend_rule_based
from .synthetic_data import Interaction, SyntheticDataset, generate_dataset


@dataclass
class EvalResult:
    precision_at_k: float
    recall_at_k: float
    n_users_evaluated: int


def _train_test_split(
    dataset: SyntheticDataset, test_fraction: float = 0.2, seed: int = 7
) -> tuple[SyntheticDataset, dict[str, set[str]]]:
    rng = random.Random(seed)
    by_user: dict[str, list[Interaction]] = {}
    for interaction in dataset.interactions:
        by_user.setdefault(interaction.user_id, []).append(interaction)

    train: list[Interaction] = []
    test: dict[str, set[str]] = {}
    for user_id, interactions in by_user.items():
        shuffled = interactions[:]
        rng.shuffle(shuffled)
        split = (
            max(1, int(len(shuffled) * (1 - test_fraction))) if len(shuffled) > 1 else len(shuffled)
        )
        train.extend(shuffled[:split])
        held_out = shuffled[split:]
        if held_out:
            test[user_id] = {i.location_id for i in held_out}

    train_dataset = SyntheticDataset(
        categories=dataset.categories,
        locations=dataset.locations,
        users=dataset.users,
        interactions=train,
    )
    return train_dataset, test


def _precision_recall_at_k(
    recommended: list[str], relevant: set[str], k: int
) -> tuple[float, float]:
    top_k = recommended[:k]
    hits = len(set(top_k) & relevant)
    precision = hits / k if k else 0.0
    recall = hits / len(relevant) if relevant else 0.0
    return precision, recall


def _evaluate(
    recommend_fn: Callable[[str], list[str]], test: dict[str, set[str]], k: int
) -> EvalResult:
    precisions, recalls = [], []
    for user_id, relevant in test.items():
        recommended = recommend_fn(user_id)
        p, r = _precision_recall_at_k(recommended, relevant, k)
        precisions.append(p)
        recalls.append(r)
    n = len(precisions)
    return EvalResult(
        precision_at_k=sum(precisions) / n if n else 0.0,
        recall_at_k=sum(recalls) / n if n else 0.0,
        n_users_evaluated=n,
    )


def evaluate_hybrid(dataset: SyntheticDataset, k: int = 10) -> EvalResult:
    train_dataset, test = _train_test_split(dataset)
    model = HybridModel(dataset=train_dataset)
    return _evaluate(lambda user_id: model.recommend(user_id, k), test, k)


def evaluate_rule_based(dataset: SyntheticDataset, k: int = 10) -> EvalResult:
    _, test = _train_test_split(dataset)
    users_by_id = {u.id: u for u in dataset.users}
    return _evaluate(
        lambda user_id: recommend_rule_based(dataset, users_by_id[user_id], k), test, k
    )


def run_ab_report(dataset: SyntheticDataset | None = None, k: int = 10) -> dict[str, EvalResult]:
    dataset = dataset or generate_dataset()
    return {
        "rule_based": evaluate_rule_based(dataset, k),
        "hybrid": evaluate_hybrid(dataset, k),
    }


if __name__ == "__main__":
    report = run_ab_report()
    for name, result in report.items():
        print(
            f"{name}: precision@k={result.precision_at_k:.3f} "
            f"recall@k={result.recall_at_k:.3f} (n={result.n_users_evaluated})"
        )
