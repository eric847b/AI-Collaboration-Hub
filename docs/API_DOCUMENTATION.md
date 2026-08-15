# API Documentation Standards

This guide ensures consistent, high-quality API documentation across all projects.

## Node.js / TypeScript

### Tools
- **TypeDoc**: Automatic TypeScript API documentation from comments

### Setup
```bash
npm install --save-dev typedoc
```

### Configuration
See `typedoc.json` for TypeDoc configuration.

### Writing Documentation

Always add JSDoc comments to:
- Exported functions
- Classes and interfaces
- Complex methods
- Public APIs

Format:
```typescript
/**
 * Brief description of the function.
 *
 * Longer explanation if needed.
 *
 * @param name - Description of parameter
 * @returns Description of return value
 * @throws ErrorType - When this error can occur
 *
 * @example
 * ```typescript
 * const result = myFunction('value');
 * ```
 */
export function myFunction(name: string): string {
  return `Hello ${name}`;
}
```

### Generation
```bash
cd nexus-infinity-hub
npx typedoc --out ../docs/api src/
```

---

## Python

### Tools
- **pdoc**: Zero-configuration Python documentation
- **Sphinx** (optional): Advanced documentation with custom themes

### Setup
```bash
pip install pdoc markdown
```

### Writing Documentation

Always add docstrings to:
- Modules (at top)
- Functions and methods
- Classes
- Complex logic

Format (Google style):
```python
def my_function(name: str) -> str:
    """
    Brief description.

    Longer description if needed.

    Args:
        name: Description of parameter

    Returns:
        Description of return value

    Raises:
        ValueError: When this can be raised

    Example:
        >>> result = my_function('Alice')
        >>> result
        'Hello Alice'
    """
    return f"Hello {name}"
```

### Generation
```bash
pip install pdoc
mkdir -p docs/api
pdoc --html --force --output-directory docs/api singularity-operator/
```

---

## GitHub Pages Deployment

Docs are automatically generated and deployed on every push to main via the `generate-docs.yml` workflow.

Access at: `https://[username].github.io/ai-collaboration-hub/`

### Manual Deployment

```bash
# Generate docs
npm run docs  # Node projects
python -m pdoc singularity-operator/  # Python projects

# View locally
open docs/index.html
```

---

## Best Practices

1. **Keep docs near code**: Docstrings stay in source files
2. **Examples matter**: Always include usage examples
3. **Type hints required**: For TypeScript and Python with type hints
4. **Link to issues**: Reference GitHub issues in relevant docs
5. **Update when API changes**: Never let docs drift from code
6. **Test examples**: Ensure doctest examples work
