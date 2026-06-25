"""Synthetic dataset generator for recsys prototyping (scope §8: "I can
also generate synthetic interaction data to sanity-check the logic before
real users exist"). Entirely self-contained — no connection to the live
Hub Postgres DB, so running this never touches production data.

Interaction probability is preference-driven (category match + budget fit
+ rating) rather than pure noise, so a model that recovers the signal can
actually be distinguished from one that doesn't in the eval harness.
"""

from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    id: str
    name: str


@dataclass(frozen=True)
class Location:
    id: str
    name: str
    category_id: str
    price_level: int  # 1-4
    rating_avg: float  # 1.0-5.0


@dataclass(frozen=True)
class User:
    id: str
    interest_category_ids: tuple[str, ...]
    budget_max: int | None  # 1-4, None = no limit


@dataclass(frozen=True)
class Interaction:
    user_id: str
    location_id: str
    weight: float  # implicit signal strength


WEIGHT_BY_KIND = {"view": 1.0, "favorite": 3.0, "review": 5.0}


@dataclass
class SyntheticDataset:
    categories: list[Category]
    locations: list[Location]
    users: list[User]
    interactions: list[Interaction]


def generate_dataset(
    n_categories: int = 8,
    n_locations: int = 200,
    n_users: int = 300,
    seed: int = 42,
) -> SyntheticDataset:
    rng = random.Random(seed)

    categories = [Category(id=f"cat_{i}", name=f"Category {i}") for i in range(n_categories)]

    locations = [
        Location(
            id=f"loc_{i}",
            name=f"Location {i}",
            category_id=rng.choice(categories).id,
            price_level=rng.randint(1, 4),
            rating_avg=round(min(5.0, max(1.0, rng.gauss(3.8, 0.7))), 1),
        )
        for i in range(n_locations)
    ]

    users = [
        User(
            id=f"user_{i}",
            interest_category_ids=tuple(
                rng.sample([c.id for c in categories], k=rng.randint(1, 3))
            ),
            budget_max=rng.choice([1, 2, 3, 4, None]),
        )
        for i in range(n_users)
    ]

    interactions: list[Interaction] = []
    for user in users:
        for location in locations:
            score = 0.05  # baseline noise — even an irrelevant location gets occasional interaction
            if location.category_id in user.interest_category_ids:
                score += 0.35
            if user.budget_max is None or location.price_level <= user.budget_max:
                score += 0.15
            score += (location.rating_avg - 1) / 4 * 0.15

            if rng.random() < score:
                kind = rng.choices(["view", "favorite", "review"], weights=[0.7, 0.22, 0.08])[0]
                interactions.append(
                    Interaction(
                        user_id=user.id,
                        location_id=location.id,
                        weight=WEIGHT_BY_KIND[kind],
                    )
                )

    return SyntheticDataset(
        categories=categories, locations=locations, users=users, interactions=interactions
    )
