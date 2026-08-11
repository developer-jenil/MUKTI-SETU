from app.golden import run_golden_tests


def test_all_golden_cases_pass() -> None:
    results = run_golden_tests()
    assert [result.id for result in results] == ["GT-01", "GT-02", "GT-03", "GT-04", "GT-05"]
    assert all(result.passed for result in results), [result.model_dump() for result in results if not result.passed]
