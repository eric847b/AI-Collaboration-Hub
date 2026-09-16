#!/usr/bin/env node
/**
 * workflow-audit.mjs - offline, dependency-free security/hygiene auditor for
 * .github/workflows/*.yml (durable rule #1: workflows must be *safe*, not merely
 * syntactically valid).
 *
 * The workspace already owns two of the three legs of workflow assurance:
 *   - actionlint          -> syntax / expression correctness
 *   - workspace-gate.ps1  -> presence + live actionlint wiring
 * This is the missing third leg: *risk*. Nothing else looks for script
 * injection, privileged triggers, unpinned actions or unbounded jobs.
 *
 *   node tools/workflow-audit.mjs                  # audit (ratcheted against baseline)
 *   node tools/workflow-audit.mjs --self-test      # prove every detector fires
 *   node tools/workflow-audit.mjs --list-rules     # print the rule table
 *   node tools/workflow-audit.mjs --json           # machine-readable report
 *   node tools/workflow-audit.mjs --strict         # medium findings also fail
 *   node tools/workflow-audit.mjs --quiet          # findings only
 *   node tools/workflow-audit.mjs --check-baseline # fail on stale (already-fixed) entries
 *   node tools/workflow-audit.mjs --update-baseline# accept current state (deliberate)
 *   node tools/workflow-audit.mjs --help           # usage
 *
 * Ratchet design (same philosophy as bundle-trend.cjs' regression gate)
 *   docs/metrics/workflow-audit-baseline.json records, per workflow+rule, how
 *   many findings are *known and accepted*. A run fails only when a workflow
 *   exceeds its accepted count, i.e. when someone actually introduces new risk.
 *   Existing debt stays visible (and shrinks) instead of blocking every commit,
 *   which is what makes the gate adoptable on a 24-workflow repo. Fixing things
 *   makes the baseline stale, never red; `--check-baseline` treats stale as an
 *   error so the ledger is trimmed in the same change that fixes a finding.
 *
 * Design notes
 *   - Read-only by default: the single writer is --update-baseline.
 *   - Offline: never calls the network, never shells out.
 *   - Line numbers are reported for humans but never used as baseline keys
 *     (they churn on any edit); the key is workflow + rule + count.
 *   - `--self-test` audits synthetic workflows held in memory, so a green run of
 *     the auditor is evidence rather than an assumption.
 *
 * Exit codes: 0 clean * 1 new findings (or --strict hits) * 2 setup error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const DEFAULT_BASELINE = path.join('docs', 'metrics', 'workflow-audit-baseline.json');

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const quiet = has('--quiet');
const asJson = has('--json');
const strict = has('--strict');
const selfTest = has('--self-test');
const listRules = has('--list-rules');
const showHelp = has('--help') || has('-h');
const checkBaseline = has('--check-baseline');
const updateBaseline = has('--update-baseline');
const verbose = has('--verbose');
function opt(name, def) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : def;
}
const baselinePath = () => {
  const given = opt('--baseline', '');
  return path.isAbsolute(given) ? given : path.join(ROOT, given || DEFAULT_BASELINE);
};

/**
 * Action inputs that originate from a user and therefore must never be
 * interpolated into a shell. `${{ }}` is substituted *before* the shell parses
 * the line, so surrounding quotes provide no protection at all.
 */
const UNTRUSTED_CONTEXT = [
  'github.event.issue.title',
  'github.event.issue.body',
  'github.event.pull_request.title',
  'github.event.pull_request.body',
  'github.event.pull_request.head.ref',
  'github.event.pull_request.head.label',
  'github.event.pull_request.head.repo.default_branch',
  'github.event.pull_request.head.repo.description',
  'github.event.pull_request.head.repo.homepage',
  'github.event.pull_request.head.repo.name',
  'github.event.review.body',
  'github.event.review_comment.body',
  'github.event.comment.body',
  'github.event.discussion.title',
  'github.event.discussion.body',
  'github.event.workflow_run.head_branch',
  'github.event.workflow_run.head_commit.message',
  'github.event.workflow_run.display_title',
  'github.event.pages.*.page_name',
  'github.event.commits.*.message',
  'github.event.commits.*.author.email',
  'github.event.commits.*.author.name',
  'github.event.head_commit.message',
  'github.event.head_commit.author.email',
  'github.event.head_commit.author.name',
  'github.head_ref',
  'github.ref_name',
  'github.event.client_payload',
];

/** Matches `github.event.issue.title` etc. against UNTRUSTED_CONTEXT (glob `*` aware). */
const UNTRUSTED_RE = UNTRUSTED_CONTEXT.map(
  (c) => new RegExp(`^${c.split('.').map((p) => (p === '*' ? '[^.]+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('\\.')}$`)
);

/** Every `${{ … }}` interpolation anywhere in a run/script body. */
const EXPR = /\$\{\{\s*([^}]*?)\s*\}\}/g;
/** Contexts supplied by a user or an untrusted repo checkout (WF010's own table is separate). */
const DISPATCH_INPUT = /^(?:github\.event\.inputs|inputs)\./;
/** `uses: owner/repo@<40 hex>` is the only immutable form. */
const SHA_PIN = /^[^@\s]+@[0-9a-f]{40}$/;

/**
 * Severity → failure policy, applied ONLY on top of the ratchet.
 *
 * The ledger is the primary gate: growth of any severity fails, accepted debt
 * never does. Severity adds a second, opt-in gate: `--strict` fails on any
 * `high`/`medium` finding regardless of the ledger, which is the switch you
 * flip once accepted debt reaches zero. `low` is always advisory.
 */
const SEVERITIES = ['high', 'medium', 'low'];
/** High severity always warrants an ATTENTION line, even when the ledger accepts it. */
const FAILING = new Set(['high']);
/** Returned by failingSeverities() outside --strict: the ledger is the only gate. */
const EMPTY_SET = new Set();

/**
 * Rule table. Each entry is metadata only; detection lives in the detectors
 * below so the self-test can assert that every id has exactly one implementation
 * and that every implementation fires on its synthetic fixture.
 */
const RULES = [
  {
    id: 'WF001',
    severity: 'high',
    title: 'Untrusted context interpolated into a shell',
    why: 'Issue/PR titles, bodies and branch names are attacker-controlled; `${{ }}` is substituted before the shell runs, so quoting cannot save you. Pass them through `env:` instead.',
  },
  {
    id: 'WF002',
    severity: 'high',
    title: 'Secret interpolated directly into a shell',
    why: '`${{ secrets.X }}` in `run:` is expanded into the script text, so it can leak through `set -x`, error output or a crafted argument. Bind it to `env:` and reference `$X`.',
  },
  {
    id: 'WF003',
    severity: 'high',
    title: 'Remote script piped into a shell',
    why: '`curl … | bash` executes whatever the remote server returns at that moment: unpinned, unverifiable, and a single upstream compromise becomes RCE in CI.',
  },
  {
    id: 'WF004',
    severity: 'medium',
    title: 'Privileged trigger',
    why: '`pull_request_target` and `workflow_run` run with a write token and access to secrets. Safe only when no untrusted checkout or input is used afterwards — review every run step.',
  },
  {
    id: 'WF005',
    severity: 'medium',
    title: 'Action not pinned to a commit SHA',
    why: 'Tags and branches are mutable, so a compromised or retagged upstream can run arbitrary code as this repo. Pin third-party actions to a 40-char SHA.',
  },
  {
    id: 'WF006',
    severity: 'medium',
    title: 'No permissions block',
    why: 'Without an explicit `permissions:` the job inherits the repository default token scope, which is often read-write. Declare the minimum at workflow or job level.',
  },
  {
    id: 'WF007',
    severity: 'high',
    title: 'Overbroad token permissions',
    why: '`write-all` grants every scope to every step, including third-party actions. List only the scopes the workflow actually needs.',
  },
  {
    id: 'WF008',
    severity: 'low',
    title: 'Job has no timeout',
    why: 'A hung job holds a runner (and a concurrency slot) until the 6-hour platform limit. Set `timeout-minutes`.',
  },
  {
    id: 'WF009',
    severity: 'low',
    title: 'Workflow has no concurrency group',
    why: 'Overlapping runs duplicate work and can race on shared state (deploys, caches, ledgers). Add a `concurrency:` group with `cancel-in-progress` where appropriate.',
  },
  {
    id: 'WF010',
    severity: 'medium',
    title: 'Workflow-dispatch input interpolated into a shell',
    why: '`github.event.inputs.*` / `inputs.*` are free-form text typed by whoever triggers the run, including in `workflow_call`. Route them through `env:` like any other untrusted value.',
  },
  {
    id: 'WF011',
    severity: 'high',
    title: 'Privileged trigger checkout of untrusted code',
    why: '`pull_request_target` + a checkout of the PR head combines a write token, secrets and attacker-controlled code: the canonical CI compromise. Never check out PR code under a privileged trigger.',
  },
  {
    id: 'WF012',
    severity: 'medium',
    title: 'Secret in workflow-level env',
    why: 'A workflow-level `env:` entry is injected into *every* job and step, including third-party actions. Scope the secret to the single step that needs it.',
  },
];

const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r]));
const SEV_ORDER = { high: 0, medium: 1, low: 2 };

/* ------------------------------------------------------------------------- *
 * Minimal workflow reader
 * ------------------------------------------------------------------------- */

/**
 * A full YAML parser is out of scope: it would mean a dependency, which tooling
 * in this repo deliberately avoids. Instead we track keys by indentation and
 * treat block scalars as opaque script text, which locates everything a
 * detector needs — triggers, permissions, workflow/job/step `env`, `uses`,
 * `run` bodies and `with` maps.
 *
 * Documented limits (rather than silent guesses):
 *   - `#` starts a comment at line start or after whitespace, so a `#` inside a
 *     quoted scalar is treated as a comment.
 *   - Anchors, aliases and flow-style mappings are not expanded.
 *   - A list item that is a bare URL is mis-read as a key. Neither pattern is
 *     used by any workflow in .github/workflows today.
 */

/** `|`, `>`, `|-`, `>2` … the block-scalar indicators a `run:` may use. */
const BLOCK_SCALAR = /^[|>][-+]?\d*$/;

/**
 * PowerShell 5.1 `Set-Content -Encoding utf8` prepends a UTF-8 BOM, which
 * `JSON.parse` rejects outright and which would corrupt the first YAML key of a
 * workflow. Everything read from disk passes through here (durable rule #11).
 */
function stripBom(text) {
  return String(text).charCodeAt(0) === 0xfeff ? String(text).slice(1) : String(text);
}

/** Split physical lines into `{ n, indent, text, raw, blank }` with comments removed. */
function toLines(source) {
  return source.replace(/\r\n?/g, '\n').split('\n').map((raw, idx) => {
    const expanded = raw.replace(/\t/g, '  ');
    const indent = expanded.length - expanded.trimStart().length;
    let text = expanded.trim();
    const hash = /(^|\s)#/.exec(text);
    if (hash) text = text.slice(0, hash.index).trim();
    return { n: idx + 1, indent, text, raw, blank: text === '' };
  });
}

/** Strip one layer of matching quotes. */
function unquote(value) {
  if (value.length > 1 && /^["']/.test(value) && value.endsWith(value[0])) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Decompose `key: value`, tolerating a leading list dash and stripped quotes.
 * The FIRST colon wins, so `run: curl https://host` keeps its URL intact.
 */
function partsOf(text) {
  const item = text.startsWith('- ') || text === '-';
  const rest = item ? text.slice(1).trim() : text;
  if (rest === '') return { item, key: null, value: '' };
  const colon = rest.indexOf(':');
  if (colon < 0) return { item, key: null, value: unquote(rest) };
  const key = rest.slice(0, colon).trim();
  return { item, key: key === '' ? null : key, value: unquote(rest.slice(colon + 1).trim()) };
}

/**
 * Immediate children of the key on `parentIndex`: the first indentation level
 * deeper than the parent, and nothing beyond it. That outermost-only rule is
 * what keeps `on: { push: { branches: [...] } }` reporting `push`, not
 * `branches`.
 */
function immediateChildren(ctx, parentIndex) {
  const { L, skip } = ctx;
  const base = L[parentIndex].indent;
  const out = [];
  let childIndent = null;
  for (let j = parentIndex + 1; j < L.length; j += 1) {
    const ln = L[j];
    if (ln.blank || skip.has(ln.n)) continue;
    if (ln.indent <= base) break;
    if (childIndent === null) childIndent = ln.indent;
    if (ln.indent !== childIndent) continue;
    const p = partsOf(ln.text);
    if (p.key) out.push({ key: p.key, value: p.value, line: ln.n, index: j });
    else if (p.item && p.value) out.push({ key: null, value: p.value, line: ln.n, index: j });
  }
  return out;
}

/** `on:` in either inline (`on: push`, `on: [a, b]`) or block form. */
function readTriggers(ctx, onIndex) {
  const { L } = ctx;
  const line = L[onIndex];
  const inline = partsOf(line.text).value;
  const out = [];
  if (inline) {
    const cleaned = inline.replace(/^\[/, '').replace(/\]$/, '');
    for (const raw of cleaned.split(',')) {
      const name = unquote(raw.trim());
      if (name) out.push({ name, line: line.n });
    }
    return out;
  }
  for (const child of immediateChildren(ctx, onIndex)) {
    const name = child.key || child.value;
    if (name) out.push({ name, line: child.line });
  }
  return out;
}

/** `permissions:` at workflow or job level, inline or block. */
function readPermissions(ctx, index, inline) {
  const { L } = ctx;
  const entries = [];
  if (inline) {
    entries.push({ key: unquote(inline), value: '', line: L[index].n });
  } else {
    for (const child of immediateChildren(ctx, index)) {
      entries.push({ key: child.key || '', value: child.value, line: child.line });
    }
  }
  return { line: L[index].n, inline, entries };
}

/** `run:` as an inline command or as the body of a block scalar. */
function readRun(ctx, index, line, p) {
  if (p.value && !BLOCK_SCALAR.test(p.value)) return { text: p.value, line: line.n };
  const block = ctx.blocks.get(line.n);
  return { text: block ? block.text : '', line: line.n, block: Boolean(block) };
}

/**
 * Parse one workflow into the shape the detectors consume. Every field is
 * optional, so a detector asks only for what it needs and cannot be broken by
 * a construct it does not care about.
 */
function parseWorkflow(source, file) {
  const L = toLines(source);
  const ctx = { L, skip: new Set(), blocks: new Map() };

  // A block scalar owns every deeper line. Record its body (dedented, so script
  // text reads naturally) and hide those lines from the key walkers, otherwise
  // `run: |` bodies would be mistaken for workflow structure.
  for (let i = 0; i < L.length; i += 1) {
    const ln = L[i];
    if (ln.blank) continue;
    const p = partsOf(ln.text);
    if (!p.key || !BLOCK_SCALAR.test(p.value)) continue;
    const body = [];
    for (let j = i + 1; j < L.length; j += 1) {
      const bl = L[j];
      if (bl.blank) {
        body.push('');
        continue;
      }
      if (bl.indent <= ln.indent) break;
      body.push(bl.raw);
      ctx.skip.add(bl.n);
    }
    const filled = body.filter((b) => b.trim() !== '');
    const strip = filled.length ? Math.min(...filled.map((b) => b.length - b.trimStart().length)) : 0;
    ctx.blocks.set(ln.n, { text: body.map((b) => b.slice(strip)).join('\n') });
  }

  // Top-level keys only (indent 0), so `jobs:` is never confused with a nested
  // `jobs:` inside `on.workflow_call`.
  const tops = [];
  for (let i = 0; i < L.length; i += 1) {
    const ln = L[i];
    if (ln.blank || ctx.skip.has(ln.n) || ln.indent !== 0) continue;
    const p = partsOf(ln.text);
    if (p.key) tops.push({ key: p.key, value: p.value, index: i, line: ln.n });
  }
  const top = (key) => tops.find((t) => t.key === key) || null;
  const mapEntries = (index) =>
    immediateChildren(ctx, index).map((c) => ({ key: c.key || '', value: c.value, line: c.line, index: c.index }));

  const onKey = top('on');
  const permKey = top('permissions');
  const envKey = top('env');
  const jobsKey = top('jobs');

  const jobs = [];
  if (jobsKey) {
    for (const job of immediateChildren(ctx, jobsKey.index)) {
      if (!job.key) continue;
      const kids = immediateChildren(ctx, job.index);
      const pick = (k) => kids.find((c) => c.key === k) || null;
      const stepsKey = pick('steps');
      const steps = [];
      if (stepsKey) {
        for (const item of immediateChildren(ctx, stepsKey.index)) {
          // The step's first key lives on the `- ` line itself, so prepend it to
          // its children (which sit one indent deeper, after the dash).
          const self = partsOf(L[item.index].text);
          const fields = immediateChildren(ctx, item.index).slice();
          if (self.key) fields.unshift({ key: self.key, value: self.value, line: item.line, index: item.index });
          const f = (k) => fields.find((c) => c.key === k) || null;
          const runKey = f('run');
          const withKey = f('with');
          steps.push({
            line: item.line,
            index: item.index,
            name: f('name') ? f('name').value : '',
            uses: f('uses') ? f('uses').value : null,
            if: f('if') ? f('if').value : '',
            run: runKey ? readRun(ctx, runKey.index, { n: runKey.line }, runKey) : null,
            env: f('env') ? mapEntries(f('env').index) : [],
            with: withKey ? mapEntries(withKey.index) : [],
          });
        }
      }
      const jobPerm = pick('permissions');
      const jobEnv = pick('env');
      const jobUses = pick('uses');
      const jobTimeout = pick('timeout-minutes');
      jobs.push({
        name: job.key,
        line: job.line,
        index: job.index,
        permissions: jobPerm ? readPermissions(ctx, jobPerm.index, jobPerm.value) : null,
        env: jobEnv ? mapEntries(jobEnv.index) : [],
        timeout: jobTimeout ? jobTimeout.value : '',
        uses: jobUses ? jobUses.value : null,
        steps,
      });
    }
  }

  return {
    file,
    source,
    lines: L,
    triggers: onKey ? readTriggers(ctx, onKey.index) : [],
    permissions: permKey ? readPermissions(ctx, permKey.index, permKey.value) : null,
    workflowEnv: envKey ? mapEntries(envKey.index) : [],
    hasConcurrency: Boolean(top('concurrency')),
    jobs,
  };
}

/* ------------------------------------------------------------------------- *
 * Detectors
 *
 * One implementation per rule id, keyed in DETECT below. --self-test asserts
 * the key sets match exactly and that every detector fires on its fixture, so
 * a rule can never be documented without an implementation (or vice versa).
 * A detector returns [{ line, message }]; the severity/file are added by audit().
 * ------------------------------------------------------------------------- */

/** The physical line of a block-scalar body row, for honest line numbers. */
function locateLine(wf, run, row) {
  if (!run.block) return run.line;
  const frag = row.trim().slice(0, 24);
  if (!frag) return run.line;
  const stop = Math.min(run.line + 80, wf.lines.length);
  for (let n = run.line + 1; n <= stop; n += 1) {
    if (wf.lines[n - 1].text.includes(frag)) return n;
  }
  return run.line;
}

/** Every `${{ … }}` body inside a `run:` text, with its best-effort line. */
function expressionsIn(wf, run) {
  const out = [];
  for (const row of run.text.split('\n')) {
    EXPR.lastIndex = 0;
    let m;
    while ((m = EXPR.exec(row)) !== null) {
      out.push({ expr: m[1].trim(), line: locateLine(wf, run, row), sourceLine: row.trim() });
    }
  }
  return out;
}

/** Visit each `${{ … }}` expression in each `run:` body of each step. */
function forEachExpression(wf, visit) {
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.run || !step.run.text) continue;
      for (const e of expressionsIn(wf, step.run)) visit(e, step, job);
    }
  }
}

/**
 * Dotted paths inside an expression that appear in the untrusted table. A word
 * scan (rather than a whole-expression match) means `format('{0}', github.event.issue.title)`
 * is caught too, which is the same injection with extra steps.
 */
function untrustedPaths(expr) {
  const hits = [];
  for (const m of expr.matchAll(/[A-Za-z_][A-Za-z0-9_.]*/g)) {
    if (!hits.includes(m[0]) && UNTRUSTED_RE.some((re) => re.test(m[0]))) hits.push(m[0]);
  }
  return hits;
}

/** WF001 — attacker-controlled context interpolated straight into a shell. */
function detectUntrustedShell(wf) {
  const out = [];
  forEachExpression(wf, (e) => {
    const paths = untrustedPaths(e.expr);
    if (paths.length) out.push({ line: e.line, message: `\${{ ${e.expr} }} — \`${paths[0]}\` is user-controlled` });
  });
  return out;
}

/** Any expression that resolves to a credential. */
const SECRET_EXPR = /^(?:secrets\.[A-Za-z0-9_]+|github\.token)$/;

/** WF002 — a secret expanded into the shell text. */
function detectSecretInShell(wf) {
  const out = [];
  forEachExpression(wf, (e) => {
    if (SECRET_EXPR.test(e.expr)) {
      out.push({ line: e.line, message: `\${{ ${e.expr} }} is expanded into the script text` });
    }
  });
  return out;
}

/** `curl … | bash` and its relatives, including the PowerShell `| iex` form. */
const PIPE_SHELL =
  /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|ksh|dash|fish|python[23]?|node|perl|ruby|pwsh|powershell)\b|\b(?:curl|wget|iwr|irm|Invoke-WebRequest)\b[^\n|]*\|\s*(?:iex|Invoke-Expression)\b/i;

/** WF003 — a remote script piped into a shell. */
function detectRemotePipe(wf) {
  const out = [];
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (step.run && step.run.text && PIPE_SHELL.test(step.run.text)) {
        out.push({ line: step.run.line, message: 'remote script piped into a shell: unpinned and unverifiable' });
      }
    }
  }
  return out;
}

/** Triggers that run with a write token and access to secrets. */
const PRIVILEGED = new Set(['pull_request_target', 'workflow_run']);

/** WF004 — privileged trigger. */
function detectPrivilegedTrigger(wf) {
  const out = [];
  for (const t of wf.triggers) {
    if (PRIVILEGED.has(t.name)) {
      out.push({ line: t.line, message: `\`${t.name}\` runs with a write token and secrets — review every step` });
    }
  }
  return out;
}

/** WF005 — an action reference that is not a 40-char commit SHA. */
function detectUnpinnedAction(wf) {
  const out = [];
  const check = (uses, line) => {
    if (!uses) return;
    const v = String(uses).trim();
    if (!v || v.startsWith('./') || v.startsWith('docker://') || SHA_PIN.test(v)) return;
    out.push({ line, message: `\`${v}\` is not pinned to a commit SHA` });
  };
  for (const job of wf.jobs) {
    check(job.uses, job.line);
    for (const step of job.steps) check(step.uses, step.line);
  }
  return out;
}

/** WF006 — no permissions block, so jobs inherit the repository default token. */
function detectNoPermissions(wf) {
  if (wf.permissions) return [];
  const undecided = wf.jobs.filter((j) => !j.permissions);
  if (!undecided.length) return [];
  return [
    {
      line: 1,
      message: `no top-level \`permissions:\` and ${undecided.length} job(s) inherit the repo default token`,
    },
  ];
}

/** WF007 — `write-all` hands every scope to every step, including third parties. */
function detectOverbroadPermissions(wf) {
  const out = [];
  const check = (perm, where) => {
    if (!perm) return;
    for (const e of perm.entries) {
      if (e.key === 'write-all' || e.value === 'write-all') {
        out.push({
          line: e.line,
          message: `\`permissions: write-all\` on ${where} grants every scope to every step`,
        });
      }
    }
  };
  check(wf.permissions, 'the workflow');
  for (const job of wf.jobs) check(job.permissions, `job \`${job.name}\``);
  return out;
}

/** WF008 — unbounded job. A hung step holds a runner until the platform limit. */
function detectNoTimeout(wf) {
  const out = [];
  for (const job of wf.jobs) {
    // A `uses:` job is a call into a reusable workflow; it has no steps of its
    // own to bound, and `timeout-minutes` is not valid on it.
    if (job.uses) continue;
    if (!job.timeout) out.push({ line: job.line, message: `job \`${job.name}\` sets no \`timeout-minutes\`` });
  }
  return out;
}

/** WF009 — no run-level mutual exclusion, so overlap is possible. */
function detectNoConcurrency(wf) {
  if (wf.hasConcurrency) return [];
  return [{ line: 1, message: 'no `concurrency:` group — overlapping runs can race on shared state' }];
}

/** WF010 — caller-supplied dispatch input interpolated into a shell. */
function detectDispatchInput(wf) {
  const out = [];
  forEachExpression(wf, (e) => {
    for (const m of e.expr.matchAll(/[A-Za-z_][A-Za-z0-9_.]*/g)) {
      if (!DISPATCH_INPUT.test(m[0])) continue;
      out.push({ line: e.line, message: `\${{ ${e.expr} }} — \`${m[0]}\` is caller-supplied text` });
      break;
    }
  });
  return out;
}

/**
 * Refs that resolve to code the *contributor* controls rather than the base
 * repo. Kept separate from UNTRUSTED_CONTEXT because WF011 is about what gets
 * checked out, and `head.sha` (a hex value) is only dangerous there.
 */
const UNTRUSTED_REF_RE =
  /github\.(?:head_ref|event\.pull_request\.head\.(?:ref|sha|label)|event\.workflow_run\.head_(?:branch|sha))/;

/** WF011 — privileged trigger that checks out attacker-controlled code. */
function detectPrivilegedCheckout(wf) {
  const privileged = wf.triggers.filter((t) => PRIVILEGED.has(t.name));
  if (!privileged.length) return [];
  const out = [];
  for (const job of wf.jobs) {
    for (const step of job.steps) {
      if (!step.uses || !/^actions\/checkout@/.test(step.uses)) continue;
      const ref = step.with.find((w) => w.key === 'ref');
      if (!ref) continue;
      if (UNTRUSTED_REF_RE.test(String(ref.value))) {
        out.push({
          line: step.line,
          message: `\`actions/checkout\` fetches \`${ref.value}\` under \`${privileged[0].name}\` — write token + secrets + untrusted code`,
        });
      }
    }
  }
  return out;
}

/** A `${{ ... }}` wrapper, or a bare `secrets.X`, in a non-`run:` value. */
const SECRET_IN_VALUE = /\$\{\{\s*(secrets\.[A-Za-z0-9_]+|github\.token)\s*\}\}|^(secrets\.[A-Za-z0-9_]+|github\.token)$/;

/** WF012 — a secret at workflow scope is injected into every job and step. */
function detectSecretInWorkflowEnv(wf) {
  const out = [];
  for (const e of wf.workflowEnv) {
    const m = SECRET_IN_VALUE.exec(String(e.value).trim());
    if (!m) continue;
    const name = m[1] || m[2];
    out.push({ line: e.line, message: `\`${e.key}\` exposes \`${name}\` to every job and step` });
  }
  return out;
}

/**
 * Rule id → implementation. `--self-test` asserts this key set matches RULES
 * exactly, in both directions, so a rule can never be documented without
 * detection (or detected without being documented).
 */
const DETECT = {
  WF001: detectUntrustedShell,
  WF002: detectSecretInShell,
  WF003: detectRemotePipe,
  WF004: detectPrivilegedTrigger,
  WF005: detectUnpinnedAction,
  WF006: detectNoPermissions,
  WF007: detectOverbroadPermissions,
  WF008: detectNoTimeout,
  WF009: detectNoConcurrency,
  WF010: detectDispatchInput,
  WF011: detectPrivilegedCheckout,
  WF012: detectSecretInWorkflowEnv,
};

/* ------------------------------------------------------------------------- *
 * Audit engine
 * ------------------------------------------------------------------------- */

/** Workflow files under .github/workflows, absolute, sorted (yml + yaml). */
function listWorkflows() {
  let names;
  try {
    names = fs.readdirSync(WORKFLOWS_DIR);
  } catch (e) {
    throw new Error(`cannot list ${path.relative(ROOT, WORKFLOWS_DIR)} (${e.code || e.message})`);
  }
  return names
    .filter((n) => /\.ya?ml$/i.test(n))
    .sort()
    .map((n) => path.join(WORKFLOWS_DIR, n));
}

/** Run every detector over one parsed workflow; add severity/file to each hit. */
function auditWorkflow(wf) {
  const findings = [];
  for (const rule of RULES) {
    const detect = DETECT[rule.id];
    if (!detect) continue; // unreachable: --self-test proves DETECT covers RULES
    for (const hit of detect(wf)) {
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: wf.file,
        line: hit.line,
        message: hit.message,
      });
    }
  }
  return findings;
}

/** Parse and audit the whole workflow directory. Throws on unreadable input. */
function audit() {
  const workflows = [];
  const findings = [];
  for (const abs of listWorkflows()) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    let source;
    try {
      source = stripBom(fs.readFileSync(abs, 'utf8'));
    } catch (e) {
      throw new Error(`cannot read ${rel} (${e.code || e.message})`);
    }
    const wf = parseWorkflow(source, rel);
    workflows.push(wf);
    findings.push(...auditWorkflow(wf));
  }
  findings.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule)
  );
  return { workflows, findings };
}

/** Counts per rule, per workflow: `{ '<rel>': { WF001: 2, ... } }`, key-sorted. */
function countsByFile(findings) {
  const raw = {};
  for (const f of findings) {
    if (!raw[f.file]) raw[f.file] = {};
    raw[f.file][f.rule] = (raw[f.file][f.rule] || 0) + 1;
  }
  const out = {};
  for (const file of Object.keys(raw).sort()) {
    out[file] = {};
    for (const rule of Object.keys(raw[file]).sort()) out[file][rule] = raw[file][rule];
  }
  return out;
}

/** `{ high: n, medium: n, low: n }`. */
function severityCounts(findings) {
  const out = {};
  for (const s of SEVERITIES) out[s] = findings.filter((f) => f.severity === s).length;
  return out;
}

/** Rules ordered high → low → id, for stable report output. */
const RULES_BY_SEVERITY = [...RULES].sort(
  (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.id.localeCompare(b.id)
);

/**
 * The ratchet: compare what a workflow raises today against what the ledger
 * accepts. `grown` = new risk (the only thing that fails); `stale` = accepted
 * debt that has been fixed, and so should be trimmed from the ledger.
 */
function ratchet(actual, accepted) {
  const grown = [];
  const stale = [];
  const files = [...new Set([...Object.keys(actual), ...Object.keys(accepted)])].sort();
  for (const file of files) {
    const now = actual[file] || {};
    const was = accepted[file] || {};
    const rules = [...new Set([...Object.keys(now), ...Object.keys(was)])].sort();
    for (const rule of rules) {
      const have = was[rule] || 0;
      const count = now[rule] || 0;
      if (count > have) grown.push({ file, rule, accepted: have, actual: count, delta: count - have });
      else if (count < have) stale.push({ file, rule, accepted: have, actual: count, delta: have - count });
    }
  }
  return { grown, stale };
}

/**
 * Notes stored inside the ledger, so the file explains itself without a round
 * trip to this tool's --help.
 */
const BASELINE_COMMENT = [
  'Accepted workflow-audit debt (ratchet ledger), owned by tools/workflow-audit.mjs.',
  'Keys are <workflow file> -> <rule id> -> accepted finding count. A run fails only',
  'when a workflow EXCEEDS its accepted count, so fixing findings never turns a build',
  'red - it turns the entry stale, and --check-baseline then asks for it to be trimmed',
  'in the same change. Line numbers are deliberately absent: they churn on every edit.',
  'The file is deterministic (no timestamps) so it only changes when the ratchet does.',
  'Regenerate deliberately with: node tools/workflow-audit.mjs --update-baseline',
];

/**
 * Parse a ledger's text into the accepted map. Split out from readBaseline so
 * the BOM and shape rules are unit-testable in memory (see runSelfTest), which
 * is the same reason the detectors have fixtures.
 */
function parseLedger(raw) {
  const parsed = JSON.parse(stripBom(raw));
  const accepted = parsed ? parsed.accepted : undefined;
  if (accepted === undefined || accepted === null) return {};
  if (typeof accepted !== 'object' || Array.isArray(accepted)) {
    throw new Error('`accepted` must be an object of { "workflow": { "WF001": count } }');
  }
  return accepted;
}

/** Resolve, read and validate the ledger. Missing/invalid input is exit 2. */
function readBaseline() {
  const file = baselinePath();
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error(`workflow-audit: no ledger at ${rel}.`);
      console.error('workflow-audit: adopt the current state with `node tools/workflow-audit.mjs --update-baseline`');
      console.error('workflow-audit: and land the ledger in the same commit.');
    } else {
      console.error(`workflow-audit: cannot read ${rel} — ${e.message}`);
    }
    process.exit(2);
  }
  let accepted;
  try {
    accepted = parseLedger(raw);
  } catch (e) {
    console.error(`workflow-audit: ${rel} is not a usable ledger — ${e.message}`);
    process.exit(2);
  }
  return { file, rel, accepted };
}

/** Write the ledger from the current audit. The only file this tool writes. */
function writeBaseline(actual, workflows, findings) {
  const file = baselinePath();
  const doc = {
    $schema: 'workflow-audit-baseline/v1',
    $comment: BASELINE_COMMENT,
    generatedBy: 'tools/workflow-audit.mjs --update-baseline',
    rules: RULES.map((r) => r.id),
    totals: {
      workflows: workflows.length,
      findings: findings.length,
      bySeverity: severityCounts(findings),
    },
    accepted: actual,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { file, doc };
}

/* ------------------------------------------------------------------------- *
 * Self-test
 *
 * A green run of this tool should be evidence, not an assumption. These
 * fixtures are audited in memory: each one is a workflow that is clean under
 * every rule *except* the single defect its rule is meant to catch, so the
 * assertion is both "the detector fires" and "nothing else fires" (precision,
 * not just recall). `expectLine` pins the reported line to the physical line of
 * the offending text, which is what makes the report trustworthy on real files.
 * ------------------------------------------------------------------------- */

/** A 40-hex pin, so fixtures that need a pinned action stay clean under WF005. */
const CHECKOUT_SHA = '11bd71901bbe5b1630ceea73d27597364c9af683';

/**
 * Build a workflow that is compliant with every rule, so that the defect a
 * fixture injects is provably the only finding it raises. Options are "remove
 * this safe thing" or "add this unsafe thing"; nothing else varies.
 */
function cleanWorkflow(stepLines, opts = {}) {
  const {
    trigger = 'on: push',
    concurrency = true,
    permissions = 'contents: read', // null omits the block (WF006 fixture)
    inlinePermissions = null, // e.g. 'write-all' (WF007 fixture)
    timeout = true,
    env = null, // e.g. 'GLOBAL_TOKEN: ${{ secrets.GLOBAL_TOKEN }}' (WF012)
  } = opts;
  const L = ['name: fixture', trigger];
  if (concurrency) L.push('concurrency:', '  group: fixture', '  cancel-in-progress: true');
  if (inlinePermissions) L.push(`permissions: ${inlinePermissions}`);
  else if (permissions) L.push('permissions:', `  ${permissions}`);
  if (env) L.push('env:', `  ${env}`);
  L.push('jobs:', '  build:', '    runs-on: ubuntu-latest');
  if (timeout) L.push('    timeout-minutes: 10');
  L.push('    steps:', ...stepLines);
  return `${L.join('\n')}\n`;
}

const OK_STEP = ['      - run: echo hi'];

const FIXTURES = [
  {
    rule: 'WF001',
    file: 'fixture-wf001.yml',
    expectLine: 'github.event.issue.title',
    expectMessage: 'user-controlled',
    source: cleanWorkflow(['      - run: echo "${{ github.event.issue.title }}"']),
  },
  {
    rule: 'WF002',
    file: 'fixture-wf002.yml',
    expectLine: 'secrets.NPM_TOKEN',
    expectMessage: 'expanded into the script text',
    source: cleanWorkflow(['      - run: npm publish --//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}']),
  },
  {
    rule: 'WF003',
    file: 'fixture-wf003.yml',
    expectLine: 'install.sh',
    expectMessage: 'piped into a shell',
    source: cleanWorkflow(['      - run: curl -fsSL https://example.com/install.sh | bash']),
  },
  {
    rule: 'WF004',
    file: 'fixture-wf004.yml',
    expectLine: 'pull_request_target',
    expectMessage: 'write token',
    source: cleanWorkflow(OK_STEP, { trigger: 'on: pull_request_target' }),
  },
  {
    rule: 'WF005',
    file: 'fixture-wf005.yml',
    expectLine: 'actions/checkout@v4',
    expectMessage: 'not pinned to a commit SHA',
    source: cleanWorkflow(['      - uses: actions/checkout@v4']),
  },
  {
    rule: 'WF006',
    file: 'fixture-wf006.yml',
    expectMessage: 'inherit the repo default token',
    source: cleanWorkflow(OK_STEP, { permissions: null }),
  },
  {
    rule: 'WF007',
    file: 'fixture-wf007.yml',
    expectLine: 'permissions: write-all',
    expectMessage: 'grants every scope',
    source: cleanWorkflow(OK_STEP, { inlinePermissions: 'write-all' }),
  },
  {
    rule: 'WF008',
    file: 'fixture-wf008.yml',
    expectLine: 'build:',
    expectMessage: 'timeout-minutes',
    source: cleanWorkflow(OK_STEP, { timeout: false }),
  },
  {
    rule: 'WF009',
    file: 'fixture-wf009.yml',
    expectMessage: 'concurrency:',
    source: cleanWorkflow(OK_STEP, { concurrency: false }),
  },
  {
    rule: 'WF010',
    file: 'fixture-wf010.yml',
    expectLine: 'github.event.inputs.target',
    expectMessage: 'caller-supplied',
    source: cleanWorkflow(['      - run: echo "${{ github.event.inputs.target }}"'], {
      trigger: 'on: workflow_dispatch',
    }),
  },
  {
    rule: 'WF011',
    file: 'fixture-wf011.yml',
    expectLine: 'actions/checkout@',
    expectMessage: 'untrusted code',
    // Also legitimately raises WF004: a privileged trigger is the precondition.
    alsoAllows: ['WF004'],
    source: cleanWorkflow(
      [
        `      - uses: actions/checkout@${CHECKOUT_SHA}`,
        '        with:',
        '          ref: ${{ github.event.pull_request.head.sha }}',
        '      - run: echo hi',
      ],
      { trigger: 'on: pull_request_target' }
    ),
  },
  {
    rule: 'WF012',
    file: 'fixture-wf012.yml',
    expectLine: 'GLOBAL_TOKEN',
    expectMessage: 'every job and step',
    source: cleanWorkflow(OK_STEP, { env: 'GLOBAL_TOKEN: ${{ secrets.GLOBAL_TOKEN }}' }),
  },
];

/**
 * Audit every fixture in memory and assert, per rule, that the detector fires
 * *once*, on the right physical line, with the expected wording, and that no
 * other detector is dragged in with it. Returns `{ checked, notes, failures }`
 * so the caller owns the exit code (and --json can report it).
 */
function runSelfTest() {
  const failures = [];
  const notes = [];

  // 1. Documentation and implementation must agree in both directions, so a
  //    rule can never be documented without detection (or the reverse).
  const documented = RULES.map((r) => r.id).sort();
  const implemented = Object.keys(DETECT).sort();
  if (documented.join(',') !== implemented.join(',')) {
    failures.push(
      `rule/implementation mismatch\n      documented: ${documented.join(' ')}\n      implemented: ${implemented.join(' ')}`
    );
  }
  notes.push(`rules = implementations (${RULES.length})`);

  // 2. Exactly one fixture per rule, and every fixture names a real rule.
  const byRule = new Map();
  for (const f of FIXTURES) {
    if (byRule.has(f.rule)) failures.push(`${f.rule}: more than one fixture (${byRule.get(f.rule).file}, ${f.file})`);
    byRule.set(f.rule, f);
    if (!RULE_BY_ID[f.rule]) failures.push(`${f.file}: targets unknown rule ${f.rule}`);
  }
  for (const r of RULES) if (!byRule.has(r.id)) failures.push(`${r.id}: no fixture — ${r.title}`);
  notes.push(`rules = fixtures (${FIXTURES.length})`);

  // 3. A fixture name must not shadow a real workflow, or a passing self-test
  //    could mask a real finding on the file it collides with.
  let real = new Set();
  try {
    real = new Set(listWorkflows().map((p) => path.basename(p)));
  } catch {
    // No .github/workflows on a machine-local checkout: nothing to collide with.
  }
  for (const f of FIXTURES) {
    if (real.has(f.file)) failures.push(`${f.file}: fixture name collides with a real workflow`);
  }

  // 4. Each fixture: the rule fires once, on the expected line, with the
  //    expected message, and precision holds (nothing else fires).
  let checked = 0;
  for (const f of FIXTURES) {
    let wf;
    let findings;
    try {
      wf = parseWorkflow(f.source, f.file);
      findings = auditWorkflow(wf);
    } catch (e) {
      failures.push(`${f.rule} ${f.file}: threw while auditing — ${e.message}`);
      continue;
    }
    const allowed = new Set([f.rule, ...(f.alsoAllows || [])]);
    const extra = findings.filter((x) => !allowed.has(x.rule));
    if (extra.length) {
      const e = extra[0];
      failures.push(
        `${f.rule} ${f.file}: precision — unexpected ${e.rule} at line ${e.line} (${e.message})`
      );
    }
    const mine = findings.filter((x) => x.rule === f.rule);
    if (mine.length !== 1) {
      failures.push(`${f.rule} ${f.file}: expected exactly 1 finding, got ${mine.length}`);
      continue;
    }
    const hit = mine[0];
    const rule = RULE_BY_ID[f.rule];
    if (hit.severity !== rule.severity) {
      failures.push(`${f.rule} ${f.file}: severity ${hit.severity} != ${rule.severity}`);
    }
    if (f.expectMessage && !hit.message.includes(f.expectMessage)) {
      failures.push(
        `${f.rule} ${f.file}: message lacks ${JSON.stringify(f.expectMessage)} — got ${JSON.stringify(hit.message)}`
      );
    }
    if (f.expectLine) {
      const text = (wf.lines[hit.line - 1] || {}).text || '';
      if (!text.includes(f.expectLine)) {
        failures.push(
          `${f.rule} ${f.file}: line ${hit.line} is ${JSON.stringify(text)} — expected ${JSON.stringify(f.expectLine)}`
        );
      }
    }
    checked += 1;
  }

  // 5. The read boundary. PowerShell writes BOMs (rule #11), so a ledger must
  //    parse with or without one; and a malformed shape must be *rejected*, not
  //    silently read as "nothing is accepted".
  const ledgerText = '{"accepted": {"a.yml": {"WF005": 2}}}';
  for (const [label, raw] of [
    ['plain', ledgerText],
    ['BOM-prefixed', `\uFEFF${ledgerText}`],
  ]) {
    let got;
    try {
      got = JSON.stringify(parseLedger(raw));
    } catch (e) {
      failures.push(`ledger (${label}): threw — ${e.message}`);
      continue;
    }
    if (got !== '{"a.yml":{"WF005":2}}') failures.push(`ledger (${label}): parsed to ${got}`);
  }
  for (const bad of ['{"accepted": [1]}', '{"accepted": "x"}', '{']) {
    let rejected = false;
    try {
      parseLedger(bad);
    } catch {
      rejected = true;
    }
    if (!rejected) failures.push(`ledger: accepted malformed input ${JSON.stringify(bad)}`);
  }
  notes.push('ledger read boundary (BOM, shape, malformed)');

  // 6. The exit-code contract. The ledger is the only default gate, so accepted
  //    debt must never fail a run, and severity may only gate under --strict.
  //    Regression: the first version filtered every `high` finding into the
  //    failure set unconditionally, so a tree whose ledger accepted that debt
  //    exited 1 while the report's own ratchet line said "ok".
  const high = { rule: 'WF003', severity: 'high', file: 'a.yml', line: 1, message: 'piped into a shell' };
  const medium = { rule: 'WF005', severity: 'medium', file: 'a.yml', line: 1, message: 'not SHA-pinned' };

  if (failingSeverities(false).size !== 0) {
    failures.push('policy: failingSeverities(false) is not empty — severity would gate beside the ledger');
  }
  if ([...failingSeverities(true)].sort().join(',') !== 'high,medium') {
    failures.push(`policy: --strict severities are [${[...failingSeverities(true)].sort()}] , expected [high,medium]`);
  }
  // The exact expression main() uses, so the contract cannot drift from it.
  const gate = (list, mode) => list.filter((f) => failingSeverities(mode).has(f.severity));
  if (gate([high, medium], false).length !== 0) {
    failures.push('policy: default mode gates by severity — accepted debt would fail the run');
  }
  if (gate([high, medium], true).length !== 2) {
    failures.push('policy: --strict does not gate high+medium');
  }
  if (gate([{ ...high, severity: 'low' }], true).length !== 0) {
    failures.push('policy: --strict gates low severity, which is meant to be advisory');
  }

  const growth = [{ file: 'a.yml', rule: 'WF005', actual: 3, accepted: 2, delta: 1 }];
  for (const [label, input, want] of [
    ['clean tree', { grown: [], strictHits: [], staleIsError: false }, 0],
    ['accepted debt (high, ledger-owned)', { grown: [], strictHits: gate([high], false), staleIsError: false }, 0],
    ['growth', { grown: growth, strictHits: [], staleIsError: false }, 1],
    ['strict hit', { grown: [], strictHits: gate([high], true), staleIsError: false }, 1],
    ['stale ledger under --check-baseline', { grown: [], strictHits: [], staleIsError: true }, 1],
    ['growth and stale together', { grown: growth, strictHits: [], staleIsError: true }, 1],
  ]) {
    const got = verdict(input);
    if (got !== want) failures.push(`verdict (${label}): exit ${got}, expected ${want}`);
  }
  notes.push('exit-code contract (ledger-only default, --strict opt-in, low always advisory)');

  return { checked, notes, failures };
}

/** Print the self-test result and return the exit code. */
function selfTestExit() {
  const { checked, notes, failures } = runSelfTest();
  if (asJson) {
    console.log(JSON.stringify({ ok: failures.length === 0, fixtures: checked, failures }, null, 2));
    return failures.length ? 1 : 0;
  }
  if (!quiet) {
    console.log('# workflow audit self-test');
    for (const n of notes) console.log(`  ok  ${n}`);
    console.log('');
  }
  if (failures.length) {
    console.error(`self-test FAIL — ${failures.length} problem(s) across ${checked} fixture(s):`);
    for (const f of failures) console.error(`  FAIL  ${f}`);
    return 1;
  }
  console.log(`self-test ok — ${checked}/${FIXTURES.length} fixtures fired exactly once, on the right line`);
  return 0;
}

/* ------------------------------------------------------------------------- *
 * Reporting
 * ------------------------------------------------------------------------- */

/** `file:line  [sev] RULE  title` + an indented message. One finding, two lines. */
function printFindings(findings) {
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  [${f.severity}] ${f.rule}  ${RULE_BY_ID[f.rule].title}`);
    console.log(`    ${f.message}`);
  }
}

/** Markdown table of rule → findings, ordered high → low. */
function printRuleTable(findings) {
  console.log('| Rule | Severity | Findings | Workflows | Title |');
  console.log('|------|----------|----------|-----------|-------|');
  for (const r of RULES_BY_SEVERITY) {
    const hits = findings.filter((f) => f.rule === r.id);
    if (!hits.length && !verbose) continue;
    const files = new Set(hits.map((f) => f.file)).size;
    console.log(`| ${r.id} | ${r.severity} | ${hits.length} | ${files} | ${r.title} |`);
  }
  console.log('');
}

/** The rule table on its own (`--list-rules`), for docs and review. */
function printRules() {
  console.log('# workflow audit rules\n');
  console.log('| Rule | Severity | Title |');
  console.log('|------|----------|-------|');
  for (const r of RULES_BY_SEVERITY) console.log(`| ${r.id} | ${r.severity} | ${r.title} |`);
  console.log('');
  for (const r of RULES_BY_SEVERITY) console.log(`${r.id} (${r.severity}) — ${r.title}\n    ${r.why}\n`);
  console.log(`failing by default: ${[...FAILING].join(', ')} (add --strict to fail on medium too)`);
  console.log('detectors: one implementation per rule, each exercised by --self-test');
  return 0;
}

/** Usage. Kept in sync with the header comment by hand; --help is the source of truth. */
function printHelp() {
  console.log(`workflow-audit — offline security/hygiene audit for .github/workflows/*.yml

usage
  node tools/workflow-audit.mjs [options]

options
  --self-test        audit 12 in-memory fixtures; prove every detector fires
  --list-rules       print the rule table (id, severity, rationale)
  --json             machine-readable report (findings + ratchet state)
  --strict           medium findings fail too (drive accepted debt to zero)
  --check-baseline   fail when the ledger accepts findings that no longer exist
  --update-baseline  rewrite the ledger from the current audit (only writer)
  --baseline <path>  use another ledger (default ${DEFAULT_BASELINE})
  --quiet            findings only; no header or tables
  --verbose          include rules with zero findings in the table
  --help             this text

exit codes
  0  clean (or nothing beyond the accepted ledger)
  1  new findings: a workflow exceeds its accepted count (or --strict hits)
  2  setup error (no ledger, unreadable/unparseable input)

reading the result
  The ledger (\`docs/metrics/workflow-audit-baseline.json\`) records how many
  findings each workflow is *allowed* to have. Only growth fails, so existing
  debt never blocks a commit; fixing debt makes the entry stale, and
  --check-baseline then asks for it to be trimmed in the same change.

  Severity is a second, opt-in gate. By default an accepted \`high\` finding is
  reported under an ATTENTION block and still exits 0 — the ledger owns that
  debt. \`--strict\` promotes high/medium to unconditional failures; flip the
  repo to it once accepted debt reaches zero. \`low\` is always advisory.

  The auditor is read-only apart from --update-baseline, never touches the
  network, and shells out to nothing.`);
  return 0;
}

/* ------------------------------------------------------------------------- *
 * Entry point
 * ------------------------------------------------------------------------- */

/**
 * Severities that fail in the current mode. The flag is a parameter, not closed
 * over, so no call site can accidentally gate by severity while the ledger is
 * still doing the gating — the defect this shape exists to prevent.
 *
 * Non-strict returns the empty set on purpose: by default the ledger is the ONLY
 * gate, so an accepted `high` finding may not fail the run. `--strict` promotes
 * high/medium to unconditional failures, which is the switch you flip once the
 * accepted debt has been driven down to zero.
 */
function failingSeverities(strictMode) {
  return strictMode ? new Set(['high', 'medium']) : EMPTY_SET;
}

/**
 * Single source of truth for the process exit code: growth, --strict hits, and
 * (under --check-baseline) a stale ledger are the only failures. Pure, so the
 * self-test can pin the contract without spawning a process.
 */
function verdict({ grown, strictHits, staleIsError }) {
  return grown.length > 0 || strictHits.length > 0 || staleIsError ? 1 : 0;
}

/** One line per growth/stale entry — the ledger-diff vocabulary of the report. */
function printDelta(entries, label) {
  for (const e of entries) {
    const sign = e.actual > e.accepted ? '+' : '-';
    console.log(`  ${e.file}  ${e.rule}  accepted ${e.accepted}, found ${e.actual} (${sign}${e.delta})  ${label}`);
  }
}

function main() {
  if (showHelp) return printHelp();
  if (listRules) return printRules();
  if (selfTest) return selfTestExit();

  let workflows;
  let findings;
  try {
    ({ workflows, findings } = audit());
  } catch (e) {
    console.error(`workflow-audit: ${e.message}`);
    return 2;
  }
  const actual = countsByFile(findings);
  const bySeverity = severityCounts(findings);

  if (updateBaseline) {
    const { file, doc } = writeBaseline(actual, workflows, findings);
    console.log(
      `workflow-audit: wrote ${path.relative(ROOT, file).replace(/\\/g, '/')} — ` +
        `${doc.totals.findings} accepted finding(s) across ${doc.totals.workflows} workflow(s)`
    );
    return 0;
  }

  const { rel, accepted } = readBaseline();
  const { grown, stale } = ratchet(actual, accepted);
  // failingSeverities(false) is the empty set, so this line cannot gate by
  // severity while the ledger is still the authority (see failingSeverities).
  const strictHits = findings.filter((f) => failingSeverities(strict).has(f.severity));
  const attention = strict ? [] : findings.filter((f) => FAILING.has(f.severity));
  const staleIsError = checkBaseline && stale.length > 0;
  const code = verdict({ grown, strictHits, staleIsError });
  const failed = code === 1;

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: !failed,
          ledger: rel,
          workflows: workflows.length,
          totals: { findings: findings.length, bySeverity },
          ratchet: { grown, stale, ledgerIsStale: staleIsError },
          strict,
          acceptedHighSeverity: attention.length,
          findings,
        },
        null,
        2
      )
    );
    return code;
  }

  if (!quiet) {
    console.log('# workflow audit\n');
    console.log(
      `${workflows.length} workflow(s), ${findings.length} finding(s) — ` +
        SEVERITIES.map((s) => `${s} ${bySeverity[s]}`).join(', ')
    );
    console.log('');
    printRuleTable(findings);
    console.log('## findings\n');
  }
  if (findings.length) printFindings(findings);
  else if (!quiet) console.log('  (none)\n');

  if (!quiet) {
    console.log('\n## ratchet\n');
    console.log(`ledger: ${rel}`);
  }

  if (grown.length) {
    console.error(`FAIL — ${grown.length} workflow/rule pair(s) exceed the accepted ledger:`);
    printDelta(grown, 'new risk');
    console.error('\nInspect each finding above, then either fix it or accept it deliberately:');
    console.error('  node tools/workflow-audit.mjs --update-baseline');
    const rules = [...new Set(grown.map((g) => g.rule))].sort();
    for (const id of rules) console.error(`\n  ${id} — ${RULE_BY_ID[id].title}\n    ${RULE_BY_ID[id].why}`);
  } else if (!quiet) {
    console.log(`ok — no workflow exceeds its accepted count (${findings.length} finding(s) accepted)`);
  }

  if (strict && strictHits.length) {
    console.error(
      `FAIL (--strict) — ${strictHits.length} finding(s) at high/medium severity, regardless of the ledger`
    );
  }

  // Accepted high-severity debt is not a failure (the ledger owns it), but it must
  // never be silent either: this is the prompt to pay the debt down and then flip
  // the repo to --strict.
  if (attention.length) {
    console.error(
      `ATTENTION — ${attention.length} accepted high-severity finding(s); ` +
        `the ledger tolerates them, so nothing fails. Pay them down and move to --strict:`
    );
    if (!quiet) printFindings(attention);
  }

  if (stale.length) {
    const line = `${stale.length} accepted finding(s) no longer exist — trim the ledger`;
    if (staleIsError) {
      console.error(`FAIL (--check-baseline) — ${line}:`);
      printDelta(stale, 'stale');
      console.error('\n  node tools/workflow-audit.mjs --update-baseline');
    } else {
      console.log(`note — ${line} (see --check-baseline)`);
      printDelta(stale, 'stale');
    }
  }

  if (verbose && !quiet) {
    console.log(`\naccepted, per workflow (${Object.keys(accepted).length} entr(ies)):`);
    for (const file of Object.keys(accepted).sort()) {
      const rules = accepted[file] || {};
      const total = Object.values(rules).reduce((a, b) => a + b, 0);
      console.log(`  ${file}  ${total}  ${Object.entries(rules).map(([r, n]) => `${r}×${n}`).join(' ')}`);
    }
  }

  return code;
}

process.exit(main());
