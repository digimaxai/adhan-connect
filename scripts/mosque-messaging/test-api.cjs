const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const uuid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
function load(file, client, fetchImpl = async () => new Response('{}'), env = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (name) => { assert.equal(name, '@supabase/supabase-js'); return { createClient: () => client }; },
    Response, AbortSignal, URL, console: { error() {} }, fetch: fetchImpl,
    process: { env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE: 'test', ...env } },
  });
  return exports.POST;
}
function query(result, filters = []) {
  const q = { then: (resolve) => Promise.resolve(result).then(resolve) };
  for (const method of ['select', 'eq', 'gte', 'lte', 'maybeSingle']) q[method] = (...args) => { filters.push([method, ...args]); return q; };
  return q;
}
const req = (body, auth = true) => new Request('https://test/api', { method: 'POST', headers: auth ? { authorization: 'Bearer test' } : {}, body: JSON.stringify(body) });
async function main() {
  let rpcCalls = [];
  let rpcResult = { data: { id: uuid }, error: null };
  let mosqueError = null;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: uuid } } }) },
    from: (table) => query({ data: table === 'mosques' ? { id: uuid, name: 'Mosque' } : { mosque_id: uuid }, error: mosqueError }),
    rpc: async (name, args) => { rpcCalls.push([name, args]); return rpcResult; },
  };
  const send = load('app/api/mosque-messages/send+api.ts', client);
  assert.equal((await send(req(null))).status, 400);
  assert.equal((await send(req([]))).status, 400);
  assert.equal((await send(req({}, false))).status, 401);
  const valid = { mosque_id: uuid, body: ' hello ', sender_type: 'listener', listener_id: other };
  for (const body of [{ ...valid, mosque_id: 'bad' }, { ...valid, body: ' ' }, { ...valid, body: 'a'.repeat(2001) }, { ...valid, sender_type: 'owner' }, { ...valid, sender_type: 'admin', listener_id: 123 }]) assert.equal((await send(req(body))).status, 400);
  assert.equal((await send(req(valid))).status, 200);
  assert.equal(rpcCalls[0][1].p_listener_id, uuid, 'Ignore forged listener identity');
  assert.equal(rpcCalls[0][1].p_body, 'hello');
  for (const [code, status] of [['P0429', 429], ['42501', 403], ['P0404', 404], ['XX000', 500]]) {
    rpcResult = { data: null, error: { code } };
    assert.equal((await send(req(valid))).status, status);
  }
  mosqueError = { message: 'database unavailable' };
  const callsBefore = rpcCalls.length;
  assert.equal((await send(req(valid))).status, 500);
  assert.equal(rpcCalls.length, callsBefore, 'Fail closed on database errors');
  mosqueError = null;
  rpcResult = { data: { id: uuid }, error: null };
  const env = { RESEND_API_KEY: 'test', MOSQUE_REQUEST_NOTIFY_EMAIL: 'test@example.com', MOSQUE_REQUEST_NOTIFY_FROM: 'test@example.com' };
  const sendFailEmail = load('app/api/mosque-messages/send+api.ts', client, async () => { throw new Error('offline'); }, env);
  assert.equal((await sendFailEmail(req(valid))).status, 200, 'Email failure must not undo saved message');
  let filters = [];
  let saved = { created_at: new Date().toISOString(), request_type: 'mosque_admin_self', mosque_name: '<img src=x>', note: '<a href="evil">click</a>', contact_website: 'https://example.com' };
  client.from = () => query({ data: saved, error: null }, filters);
  let email;
  const notify = load('app/api/notify-mosque-request+api.ts', client, async (_, options) => { email = options; return new Response('{}'); }, env);
  assert.equal((await notify(req(null))).status, 400);
  assert.equal((await notify(req({ request_type: 'fake', mosque_name: 'fake' }))).status, 400);
  assert.equal((await notify(req({ request_id: uuid }, false))).status, 401);
  assert.equal((await notify(req({ request_id: uuid }))).status, 200);
  assert.ok(filters.some(([method, col, value]) => method === 'eq' && col === 'submitted_by' && value === uuid));
  assert.equal(email.headers['Idempotency-Key'], `mosque-request/${uuid}`);
  const html = JSON.parse(email.body).html;
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.ok(!html.includes('<img src=x>'));
  assert.ok(html.includes('&lt;a href=&quot;evil&quot;&gt;'));
  saved = null;
  assert.equal((await notify(req({ request_id: other }))).status, 404);
  console.log('API validation, authorization, rate-limit mapping, email ownership, escaping and fail-open tests passed.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
