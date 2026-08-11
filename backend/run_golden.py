from app.golden import run_golden_tests

results = run_golden_tests()
for result in results:
    print(f"{result.id}: {'PASS' if result.passed else 'FAIL'} - {result.name}")
raise SystemExit(0 if all(result.passed for result in results) else 1)
