from pathlib import Path
from typing import Any

import yaml

from app.core.rule_engine import RuleEngine
from app.models import GoldenTestResult


FIXTURE_PATH = Path(__file__).parents[1] / "tests" / "fixtures" / "golden_tests.yaml"


def run_golden_tests() -> list[GoldenTestResult]:
    fixtures: dict[str, Any] = yaml.safe_load(FIXTURE_PATH.read_text(encoding="utf-8"))
    engine = RuleEngine()
    results: list[GoldenTestResult] = []
    for fixture in fixtures["tests"]:
        decision = engine.evaluate(fixture["input"]).model_dump(mode="json")
        expected = fixture["expected"]
        actual = {key: decision.get(key) for key in expected}
        results.append(GoldenTestResult(
            id=fixture["id"], name=fixture["name"], passed=actual == expected,
            expected=expected, actual=actual,
        ))
    return results
