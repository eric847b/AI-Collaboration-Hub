"""Regression tests for the self_heal bug-class detectors.

Each test builds a scratch .github layout (via tmp_path + monkeypatching the
module-global GITHUB_DIR) so every detector can be exercised in isolation —
positive (clean -> no issues) and negative (injected bug -> issue reported).

This permanently regression-tests the immunity system, so a future refactor
that silently breaks a detector fails CI immediately.
"""

from pathlib import Path

import pytest
import self_heal  # noqa: E402  (path provided by conftest.py)

CLEAN_PY = "x = 1\n"


@pytest.fixture
def sandbox(tmp_path, monkeypatch):
    """Point self_heal at an isolated scratch .github dir."""
    gh = tmp_path / ".github"
    (gh / "scripts").mkdir(parents=True)
    (gh / "workflows").mkdir(parents=True)
    monkeypatch.setattr(self_heal, "GITHUB_DIR", str(gh))
    monkeypatch.setenv("ACTIONLINT", "")
    return gh


@pytest.fixture
def clean_py(sandbox):
    p = Path(sandbox) / "scripts" / "clean.py"
    p.write_text(CLEAN_PY, encoding="utf-8")
    return p


def test_syntax_clean(clean_py):
    assert self_heal.check_syntax() == []


def test_syntax_catches_bad_parse(sandbox):
    bad = Path(sandbox) / "scripts" / "bad.py"
    bad.write_text("def f(:\n", encoding="utf-8")
    issues = self_heal.check_syntax()
    assert any("bad.py" in i and "SyntaxError" in i for i in issues)


def test_undefined_names_clean(clean_py):
    assert self_heal.check_undefined_names() == []


def test_undefined_names_catches_unknown(sandbox):
    p = Path(sandbox) / "scripts" / "u.py"
    p.write_text("y = totally_undefined_thing + 1\n", encoding="utf-8")
    issues = self_heal.check_undefined_names()
    assert any("totally_undefined_thing" in i for i in issues)


def test_lint_patterns_clean(clean_py):
    assert self_heal.check_lint_patterns() == []


def test_lint_catches_bare_except(sandbox):
    p = Path(sandbox) / "scripts" / "bare.py"
    p.write_text("try:\n    x = 1\nexcept:\n    pass\n", encoding="utf-8")
    issues = self_heal.check_lint_patterns()
    assert any("bare.py" in i and "E722" in i for i in issues)


def test_deprecated_datetime_clean(clean_py):
    assert self_heal.check_deprecated_datetime() == []


def test_deprecated_datetime_catches_real_call(sandbox):
    p = Path(sandbox) / "scripts" / "dt.py"
    p.write_text("import datetime\nz = datetime.utcnow()\n", encoding="utf-8")
    issues = self_heal.check_deprecated_datetime()
    assert any("dt.py" in i and "utcnow" in i for i in issues)


def test_deprecated_datetime_ignores_string_literal(sandbox):
    """The AST detector must NOT flag its own message strings (self-FP)."""
    p = Path(sandbox) / "scripts" / "msg.py"
    p.write_text('MSG = "deprecated datetime.utcnow()"\n', encoding="utf-8")
    assert self_heal.check_deprecated_datetime() == []


def test_workflows_clean(sandbox):
    wf = Path(sandbox) / "workflows" / "ok.yml"
    wf.write_text("name: ok\non: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps: []\n", encoding="utf-8")
    try:
        import yaml  # noqa: F401
    except ImportError:
        pytest.skip("yaml not installed")
    assert self_heal.check_workflows() == []


def test_workflows_catches_job_level_working_dir(sandbox):
    wf = Path(sandbox) / "workflows" / "bad.yml"
    wf.write_text(
        "name: bad\non: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    working-directory: foo\n    steps: []\n",
        encoding="utf-8",
    )
    try:
        import yaml  # noqa: F401
    except ImportError:
        pytest.skip("yaml not installed")
    issues = self_heal.check_workflows()
    assert any("bad.yml" in i and "working-directory" in i for i in issues)


def test_dead_code_clean(clean_py):
    assert self_heal.check_dead_code() == []


def test_dead_code_catches_unreachable_after_return(sandbox):
    p = Path(sandbox) / "scripts" / "dead.py"
    p.write_text("def f():\n    return 1\n    x = 2\n", encoding="utf-8")
    issues = self_heal.check_dead_code()
    assert any("dead.py" in i and "dead code after return" in i for i in issues)


def test_heal_repairs_utcnow(sandbox):
    p = Path(sandbox) / "scripts" / "dt.py"
    p.write_text("from datetime import datetime\nz = datetime.utcnow()\n", encoding="utf-8")
    repairs = self_heal.heal()
    assert repairs
    text = p.read_text(encoding="utf-8")
    assert "datetime.now(UTC)" in text
    assert "utcnow" not in text
    # after heal, the detector is clean
    assert self_heal.check_deprecated_datetime() == []


def test_run_all_checks_includes_all_classes():
    checks = self_heal.run_all_checks()
    expected = {
        "syntax", "undefined_names", "lint", "ruff",
        "deprecated_datetime", "workflows", "actionlint", "imports", "dead_code",
    }
    assert expected <= set(checks)
