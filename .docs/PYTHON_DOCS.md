# Python Documentation Configuration

This directory contains documentation generation for Python projects.

## Projects Documented

- **singularity-operator**: Multi-AI orchestrator tool
- **autonomous-github-agent**: GitHub automation agent

## Tools

- **pdoc**: Automatic Python API documentation
- **sphinx** (optional): Advanced documentation with custom themes

## Generation

Run from root:
```bash
# Install tools
pip install pdoc markdown

# Generate all docs
mkdir -p docs/api
pdoc --html --force --output-directory docs/api singularity-operator/
pdoc --html --force --output-directory docs/api autonomous-github-agent/
```

## Documentation Standards

Python modules should have:
- Module docstrings (at top of file)
- Function/class docstrings (doctest format)
- Type hints (for pdoc to pick up)
- Examples in docstrings

Example:
```python
def process_data(input_path: str) -> dict:
    """
    Process input data from file.

    Args:
        input_path: Path to input file

    Returns:
        Processed data dictionary

    Raises:
        FileNotFoundError: If input file doesn't exist

    Example:
        >>> data = process_data('input.json')
        >>> len(data) > 0
        True
    """
```

## Viewing Docs

After generation, open `docs/api/index.html` to browse documentation.
