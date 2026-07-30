from pathlib import Path
root = Path(r'C:\Users\Eric\OneDrive\Documents\Userscripts\AI Chat Websites\Userscripts\AI Chat Userscript Studio\Userscript Suite\Modules')
files = sorted(root.rglob('*-rmd-*.user.js'))
for path in files:
    print('---', path.name)
    lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
    for i, line in enumerate(lines[:120], 1):
        if 'function ' in line or 'const ' in line or 'window.' in line or 'window[' in line:
            print(f'{i}: {line}')
    print()
