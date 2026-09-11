const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const calls = [];
let fail = false;
function query() {
  const filters = [];
  const q = {};
  for (const method of ['select', 'eq', 'order']) q[method] = (...args) => { filters.push([method, ...args]); return q; };
  q.range = async (from, to) => {
    calls.push({ filters, from, to });
    return { data: Array.from({ length: from === 0 ? 500 : 1 }, (_, i) => ({ id: String(from + i) })), error: null };
  };
  return q;
}
const supabase = {
  from: () => query(),
  rpc: async (name, args) => { calls.push({ name, args }); return { error: fail ? new Error('denied') : null }; },
};
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/api/mosqueMessages.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: exportsObject,
  require: (name) => name === '../supabase' ? { supabase } : {},
});
async function main() {
  const messages = await exportsObject.fetchListenerThread('mosque', 'listener');
  assert.equal(messages.length, 501, 'Pagination must include messages beyond the first page');
  for (const call of calls) {
    assert.ok(call.filters.some(([op, field, value]) => op === 'eq' && field === 'listener_id' && value === 'listener'), 'Dual-role users must still query only their own listener thread');
    assert.ok(call.filters.some(([op, field, value]) => op === 'eq' && field === 'deleted_by_listener' && value === false));
  }
  await exportsObject.markThreadReadByListener('mosque', ['seen']);
  assert.equal(calls.at(-1).args.p_action, 'listener_read');
  assert.equal(calls.at(-1).args.p_message_ids[0], 'seen', 'Only displayed messages are marked read');
  fail = true;
  await assert.rejects(exportsObject.deleteListenerThread('mosque'), /denied/);
  await assert.rejects(exportsObject.archiveAdminThread('mosque', 'listener'), /denied/);
  console.log('Client pagination, dual-role scoping, read selection and mutation error propagation passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
