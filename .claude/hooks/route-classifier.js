#!/usr/bin/env node
/**
 * UserPromptSubmit hook: classify prompt complexity, write optimal model to settings.local.json
 *
 * Tiers:
 *   HAIKU  — reads, lookups, git queries, single-file formatting/typos, status checks
 *   SONNET — multi-file features, bug fixes, tests, moderate refactors (default)
 *   OPUS   — architecture decisions, cross-cutting refactors, security design, major migrations
 */

const fs   = require('fs');
const path = require('path');

const MODELS = {
  haiku:  'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus:   'claude-opus-4-7',
};

// --- Tier patterns (evaluated in order: opus first, then haiku, else sonnet) ---

const OPUS_PATTERNS = [
  /\b(architect(ure)?|system design)\b.{0,80}\b(decision|overhaul|refactor|rewrite|redesign)\b/i,
  /\b(refactor|rewrite|redesign)\b.{0,80}\b(entire|whole|system|platform|all of|the app)\b/i,
  /\bmigrat(e|ion)\b.{0,80}\b(framework|major.?version|entire|whole)\b/i,
  /\b(security|auth(entication|orization)?)\b.{0,80}\b(design|system|overhaul|rewrite|architecture)\b/i,
  /\bcross[- ]?(cutting|system|module)\b.{0,80}\b(refactor|change|rewrite)\b/i,
  /\bschema\b.{0,80}\b(redesign|overhaul|migration)\b/i,
  /\b(rethink|rearchitect|redesign)\b.{0,30}\b(how|the|our)\b/i,
  /\bfrom scratch\b/i,
  /\bnovel algorithm\b/i,
  /\bcomplex.{0,60}debug.{0,60}\b(system|integration|cross)\b/i,
  /\bmultiple (files|modules|components|systems|tables)\b.{0,40}\b(refactor|rewrite|change|update)\b/i,
];

const HAIKU_PATTERNS = [
  // Interrogative short lookups
  /^(what|where|show|read|display|list|find|check|is there|does|can you show|how do i find)\b/i,
  /^explain (this|the|what|how)\b/i,
  // Git read ops
  /\bgit (status|log|diff|show|blame|stash list)\b/i,
  // Single-file trivial edits
  /\b(typo|spelling|misspelling)\b/i,
  /\b(add|remove|fix)\b.{0,8}\b(import|export)\b/i,
  /\b(format|lint|prettier|eslint)\b.{0,40}\b(this|file|fix|run)\b/i,
  /\b(rename|renames)\b.{0,30}\b(variable|function|class|constant|prop)\b/i,
  /\bsingle[- ]?file\b/i,
  // File reads / lookups
  /\b(read|open|view|show me|look at)\b.{0,25}\b(this file|the file|file)\b/i,
  // Status / version checks
  /\b(tsc|typescript)\b.{0,20}\b(errors|check|output)\b/i,
  /\b(build|compile|lint)\b.{0,20}\b(status|output|result|errors)\b/i,
  /\b(version|installed|running)\b/i,
  // Simple boolean questions
  /^(is|are|does|did|has|have|will|can)\b.{0,60}\?$/i,
];

function classify(text) {
  const t = text.trim();

  for (const p of OPUS_PATTERNS) {
    if (p.test(t)) return { key: 'opus', tier: 'OPUS', reason: 'complex architecture or multi-system task' };
  }

  for (const p of HAIKU_PATTERNS) {
    if (p.test(t)) return { key: 'haiku', tier: 'HAIKU', reason: 'simple lookup, status check, or single-file fix' };
  }

  // Very short prompts that didn't match opus → likely simple, unless they start with a work verb
  const WORK_VERB = /^(write|add|implement|create|build|fix|debug|refactor|update|modify|change|delete|remove|migrate|upgrade|deploy|move|extract|split|merge)\b/i;
  const wordCount = t.split(/\s+/).length;
  if (wordCount <= 7 && !WORK_VERB.test(t)) return { key: 'haiku', tier: 'HAIKU', reason: 'short query' };

  return { key: 'sonnet', tier: 'SONNET', reason: 'moderate complexity' };
}

function persistModel(model) {
  const localSettings = path.join(process.cwd(), '.claude', 'settings.local.json');
  try {
    let cfg = {};
    if (fs.existsSync(localSettings)) {
      cfg = JSON.parse(fs.readFileSync(localSettings, 'utf8'));
    }
    if (cfg.model === model) return; // no change needed
    cfg.model = model;
    fs.writeFileSync(localSettings, JSON.stringify(cfg, null, 2) + '\n');
  } catch (_) {
    // Never break the prompt pipeline
  }
}

// --- Main ---
let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const payload   = JSON.parse(raw);
    const prompt    = payload.prompt || payload.message || '';
    const { key, tier, reason } = classify(prompt);
    const model     = MODELS[key];

    persistModel(model);
    process.stdout.write(`[router] ${tier} → ${model}  (${reason})\n`);
  } catch (_) {
    // Silent failure — never block the user
  }
  process.exit(0);
});
