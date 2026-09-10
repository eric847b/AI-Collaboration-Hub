"""Pytest fixtures/shared config for the .github test suite.

`.github/scripts` is on sys.path via pyproject `[tool.pytest.ini_options]
pythonpath`, so `import self_heal` works directly in test modules.
"""
