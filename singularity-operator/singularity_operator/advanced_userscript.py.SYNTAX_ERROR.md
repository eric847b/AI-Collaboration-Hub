# Syntax error in `./singularity-operator/singularity_operator/advanced_userscript.py`

File `./singularity-operator/singularity_operator/advanced_userscript.py` fails to parse.
Line 14: unterminated string literal (detected at line 14)
Text: '        script = f"// ==UserScript==\\n// @name Singularity Advanced Userscript\\n// @version 0.3\\n// @description {\' + \'.join(features)}\\n// ==/UserScript==\\n\\nconsole.log(\'Advanced Singularity userscript active - full auto-evolve, Groq, browser hooks\');'

Common causes: unterminated f-string, mismatched quotes, invalid escapes inside nested string literals.
