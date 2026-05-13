Classify the task and set the optimal model for it.

Input: $ARGUMENTS
- If a tier name (haiku / sonnet / opus), force that tier without classifying.
- If a task description, classify it using the rules below.
- If empty, classify the most recent user message in this conversation.

---

## Main model tiers

| Tier | Model | Use for |
|------|-------|---------|
| **HAIKU** | claude-haiku-4-5-20251001 | File reads, git queries, status checks, single-file typos/formatting/imports, simple renames, short factual lookups |
| **SONNET** | claude-sonnet-4-6 | Multi-file bug fixes, new features following existing patterns, tests, API integrations, moderate refactors, UI components, DB migrations (non-breaking) |
| **OPUS** | claude-opus-4-7 | Architecture decisions, cross-cutting refactors (5+ files), security/auth design, novel algorithms, major framework migrations, schema redesigns |

## Escalation signals (push up a tier)

- "entire / whole / system / platform / all of" → +1 tier
- Security or auth changes with broad impact → OPUS
- Task touches RLS policies + multiple tables → OPUS
- Debugging across live streaming, prayer times, AND rota simultaneously → OPUS

---

## Sub-agent model overrides (Agent tool)

**Always set an explicit `model` parameter when spawning sub-agents.**
Sub-agents inherit the parent model when `model` is omitted — if the parent is Sonnet or Opus, every spawned agent also runs at that cost.

| subagent_type | model | Why |
|---------------|-------|-----|
| `Explore` | `haiku` | Pure glob/grep/read — no generation, cheapest possible |
| `claude-code-guide` | `haiku` | Docs and FAQ lookups |
| `statusline-setup` | `haiku` | Reads one config file |
| `Plan` | `sonnet` | Needs reasoning; upgrade to `opus` only for system-wide architecture |
| `general-purpose` | `sonnet` | Default; upgrade to `opus` only when the sub-task itself is OPUS-tier |

**Rule:** Match the sub-agent model to the sub-task complexity, not the parent task complexity.
If the parent is OPUS (e.g. "redesign live streaming") but a sub-agent is only searching for file locations, that sub-agent should still be `haiku`.

---

## Steps to execute

1. Determine the tier (HAIKU / SONNET / OPUS) and write a one-sentence reason.
2. Use the Bash tool to write the model to `.claude/settings.local.json`:
   ```bash
   node -e "
   const fs=require('fs'),p='.claude/settings.local.json';
   let c={};try{c=JSON.parse(fs.readFileSync(p,'utf8'))}catch(_){};
   c.model='<MODEL_ID>';
   fs.writeFileSync(p,JSON.stringify(c,null,2)+'\n');
   console.log('model set');
   "
   ```
   Replace `<MODEL_ID>` with the correct ID from the table above.
3. Reply in this format:
   > **[TIER]** — reason.
   > Model set to `model-id`. This and all following turns will use [TIER].
   > Run `/route <tier>` to override manually.
