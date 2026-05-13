#!/usr/bin/env node
/**
 * PreToolCall hook for the Agent tool.
 * Checks whether an explicit model override is set.
 * If not, recommends the cheapest appropriate model for the sub-agent type.
 *
 * Mapping rationale:
 *   Explore          → haiku   (pure glob/grep/read — no generation)
 *   claude-code-guide → haiku  (docs + FAQ lookups)
 *   statusline-setup  → haiku  (reads one config file)
 *   Plan              → sonnet (needs reasoning; Opus only if architecture decision)
 *   general-purpose   → sonnet (default; upgrade to opus when architecting)
 */

const DEFAULTS = {
  'Explore':            { model: 'haiku',  reason: 'read-only search, no generation' },
  'claude-code-guide':  { model: 'haiku',  reason: 'docs/FAQ lookup' },
  'statusline-setup':   { model: 'haiku',  reason: 'single config file read' },
  'Plan':               { model: 'sonnet', reason: 'planning needs reasoning, not Opus by default' },
  'general-purpose':    { model: 'sonnet', reason: 'default capable agent' },
};

const COST_NOTE = { haiku: '~20× cheaper than opus', sonnet: '~5× cheaper than opus', opus: 'most capable' };

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw);
    const input   = payload.tool_input || {};
    const type    = input.subagent_type || 'general-purpose';
    const model   = input.model;            // set → explicit override, undefined → inherited
    const rec     = DEFAULTS[type];

    if (model) {
      // Override was set — just confirm
      process.stdout.write(`[agent-router] Agent(${type}) model="${model}" ✓\n`);
    } else {
      const suggested = rec ? rec.model : 'sonnet';
      const reason    = rec ? rec.reason : 'no mapping — defaulting to sonnet';
      process.stdout.write(
        `[agent-router] ⚠ Agent(${type}) has no model override.\n` +
        `  Recommended: model="${suggested}"  (${reason}, ${COST_NOTE[suggested]})\n` +
        `  Add model: "${suggested}" to this Agent call to avoid inheriting parent model.\n`
      );
    }
  } catch (_) {
    // Never block the pipeline
  }
  process.exit(0);
});
