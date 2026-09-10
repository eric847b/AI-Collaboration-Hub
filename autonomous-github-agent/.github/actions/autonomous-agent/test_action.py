from pathlib import Path

ACTION = Path(__file__).with_name("action.yml")


def test_missing_entrypoint_fails_fast():
    text = ACTION.read_text()

    assert 'echo "No .github/scripts/agent.py found" >&2' in text
    assert "          exit 1" in text
    assert "running placeholder mode" not in text


def test_status_command_is_valid_yaml_scalar():
    text = ACTION.read_text()

    assert 'run: \'echo "autonomous-agent: completed"\'' in text
