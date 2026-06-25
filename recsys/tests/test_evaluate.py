from app.evaluate import evaluate_hybrid, evaluate_rule_based, run_ab_report
from app.synthetic_data import generate_dataset


def test_evaluate_rule_based_returns_metrics_in_range():
    ds = generate_dataset(n_locations=100, n_users=40, seed=4)
    result = evaluate_rule_based(ds, k=10)
    assert 0.0 <= result.precision_at_k <= 1.0
    assert 0.0 <= result.recall_at_k <= 1.0
    assert result.n_users_evaluated > 0


def test_evaluate_hybrid_returns_metrics_in_range():
    ds = generate_dataset(n_locations=100, n_users=40, seed=4)
    result = evaluate_hybrid(ds, k=10)
    assert 0.0 <= result.precision_at_k <= 1.0
    assert 0.0 <= result.recall_at_k <= 1.0
    assert result.n_users_evaluated > 0


def test_both_models_evaluated_on_the_same_held_out_users():
    ds = generate_dataset(n_locations=100, n_users=40, seed=4)
    rule = evaluate_rule_based(ds, k=10)
    hybrid = evaluate_hybrid(ds, k=10)
    assert rule.n_users_evaluated == hybrid.n_users_evaluated


def test_run_ab_report_returns_both_models():
    report = run_ab_report(generate_dataset(n_locations=80, n_users=30, seed=6), k=10)
    assert set(report.keys()) == {"rule_based", "hybrid"}
