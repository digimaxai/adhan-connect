import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { isPublicIPv4, checkedUrl, robotsAllows } from './mosque-assistant/safe-fetch.mjs';
import { extractMosque } from './mosque-assistant/extract.mjs';
const js = ts.transpileModule(fs.readFileSync(new URL('../lib/mosqueAssistant/core.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = { exports: {}, URL, Intl, Date }; vm.runInNewContext(js, context); const core = context.exports;
const table = { title: 'September', source_url: 'https://example.org/timetable', headers: ['Date','Fajr Beginning','Fajr Jamaat','Zuhr Beginning','Asr Beginning','Maghrib','Isha','Sunrise'], rows: [['1','05:10','05:30','1:15 pm','16:30','19:42','21:00','06:15']], notes: [] };
const review = () => ({ profile: {}, table: structuredClone(table), mapping: core.suggestMapping(table.headers), timeZone: 'Europe/London', websiteConfirmed: true, warningsAccepted: true });
test('maps beginning and jamaat separately, normalizes date/PM and preserves ignored columns', () => {
  const r = review(); const result = core.validateReview(r, '2026-09', '2026-09-01');
  assert.equal(result.errors.length, 0); assert.equal(result.rows[0].dhuhr, '13:15'); assert.equal(result.rows[0].date, '2026-09-01'); assert.equal(result.rows[0].fajr_iqama, '05:30');
  assert.ok(result.warnings.some(w => w.includes('Unmapped'))); assert.equal(r.table.headers[7], 'Sunrise'); assert.ok(!core.toCsv(result.rows).includes('Sunrise'));
});
test('rejects duplicate dates, invalid dates, missing beginning and duplicate mappings', () => {
  const r = review(); r.table.rows.push([...r.table.rows[0]]); assert.ok(core.validateReview(r,'2026-09').errors.some(e => e.includes('Duplicate date')));
  assert.throws(() => core.normalizeDate('31/09/2026','2026-09')); assert.throws(() => core.normalizeDate('01/10/2026','2026-09'));
  r.table.rows = [['1','','','','','','','']]; assert.ok(core.validateReview(r,'2026-09').errors.some(e => e.includes('Missing fajr')));
  r.mapping.isha = r.mapping.fajr; assert.ok(core.validateReview(r,'2026-09').errors.some(e => e.includes('duplicate mapping')));
});
test('strict times do not infer ambiguous afternoon values or invent iqama', () => {
  assert.equal(core.normalizeTime('1:15'), '01:15'); assert.equal(core.normalizeTime('12:00 am'),'00:00'); assert.equal(core.normalizeTime('12:00 pm'),'12:00'); assert.equal(core.normalizeTime(''),null);
  for (const t of ['24:00','12:70','13:00 pm','after sunset']) assert.throws(() => core.normalizeTime(t));
  const r = review(); r.table.rows[0][3] = '1:15'; assert.ok(core.validateReview(r,'2026-09').warnings.some(w => w.includes('AM/PM')));
});
test('requires owner source verification and validates field URLs/timezone', () => {
  const r = review(); r.websiteConfirmed = false; r.timeZone = 'Not/AZone'; r.profile.contact_email = { value: 'bad', source_url: 'javascript:alert(1)', evidence: '' };
  assert.ok(core.validateReview(r,'2026-09').errors.length >= 4);
});
test('blocks local network, metadata, encoded IPs, credentials and unsupported schemes', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.2','100.64.0.1','224.0.0.1','198.18.0.1']) assert.equal(isPublicIPv4(ip),false,ip);
  assert.equal(isPublicIPv4('93.184.216.34'),true);
  for (const url of ['http://example.org','https://127.1','https://2130706433','https://[::1]','https://user:pass@example.org','https://site.internal','https://example.org:444']) assert.throws(() => checkedUrl(url));
});
test('honors crawl restrictions and longest matching allow rules', () => {
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/secret'),false);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/public', '/private/public'),true);
  assert.equal(robotsAllows('User-agent: Other\nDisallow: /\nUser-agent: *\nAllow: /','/'),true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /*.pdf$', '/times.pdf'),false);
});
test('extraction passes HTML, PDFs and images to provider and rejects unsupported citations', async () => {
  const calls = []; let n = 0;
  const response = async body => { calls.push(body); n++;
    if (n === 1) return { text: 'Official mosque https://example.org; timetable links.' };
    if (n === 2) return { text: JSON.stringify({ website: 'https://example.org', reason: 'Address matches', urls: ['https://example.org/times.pdf','https://example.org/prayer.png'] }) };
    return { text: JSON.stringify({ website: 'https://example.org', match_reason: 'Address matches', warnings: [], fields: [{ field:'city',value:'London',source_url:'https://fabricated.org',evidence:'made up' }], tables:[table] }) };
  };
  const fetchPublic = async url => ({ url: new URL(url).href, type: url.endsWith('.pdf') ? 'application/pdf' : url.endsWith('.png') ? 'image/png' : 'text/html', bytes: Buffer.from(url.endsWith('.pdf') ? '%PDF-1.4' : '<html>Mosque</html>') });
  const result = await extractMosque({ name: 'Example Mosque' },'2026-09',null,{response,fetchPublic,noDelay:true});
  assert.equal(result.sources.length,3); assert.equal(result.extraction.fields.length,0); assert.equal(result.extraction.tables.length,0);
  const content = calls[2].input[0].content; assert.ok(content.some(c => c.type === 'input_file')); assert.ok(content.some(c => c.type === 'input_image')); assert.equal(calls[0].tool_choice,'required');
});
function apiWithAuth(auth, db = {}) {
  const source = fs.readFileSync(new URL('../app/api/admin/mosque-assistant+api.ts', import.meta.url),'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = { exports: {}, URL, Date, Response, require: name => {
    if (name.endsWith('adminAccess')) return { requireAdminAccess: async () => auth || { context: { isMainAdmin: true, userId: 'owner', supabaseAdmin: db } }, json: (body,status = 200) => new Response(JSON.stringify(body), { status }) };
    if (name.endsWith('mosqueDirectory')) return {};
    if (name.endsWith('/core')) return core;
    throw new Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(compiled,api); return api.exports;
}
test('API denies unauthenticated and local-admin access before any database action', async () => {
  const req = new Request('https://app.example.org/api/admin/mosque-assistant', { method:'POST', body:'{}' });
  const local = apiWithAuth({ context: { isMainAdmin:false } });
  assert.equal((await local.POST(req)).status,403);
  assert.equal((await local.GET(req)).status,403);
  const anonymous = apiWithAuth({ response: new Response('',{status:401}) });
  assert.equal((await anonymous.POST(req)).status,401);
});
test('API enqueues all mosques only for an explicit null selection and rejects unsafe overrides', async () => {
  const calls = []; const api = apiWithAuth(null, { rpc: async (name,args) => { calls.push({ name,args }); return { data: 7 }; } });
  const post = body => api.POST(new Request('https://app.example.org/api/admin/mosque-assistant', { method:'POST', body:JSON.stringify(body) }));
  assert.equal((await post({ action:'scan',month:'2026-09' })).status,400);
  assert.equal((await post({ action:'scan',month:'2026-09',mosqueIds:null,website:'https://127.0.0.1' })).status,400);
  const res = await post({ action:'scan',month:'2026-09',mosqueIds:null }); assert.equal(res.status,200);
  assert.equal((await res.json()).queued,7); assert.equal(calls.length,1); assert.equal(calls[0].args.p_ids,null);
});
test('worker prepares converted schedules and profile proposals without a dashboard visit', () => {
  const extraction = { fields: [{ field:'contact_email',value:'office@example.org',source_url:'https://example.org/contact',evidence:'Office email' }], tables: [table], website:'https://example.org', match_reason:'Address', warnings:[] };
  const result = core.prepareExtraction(extraction,'2026-09','Europe/London');
  assert.equal(result.conversions[0].status,'converted'); assert.ok(result.conversions[0].csv.includes('2026-09-01,05:10,05:30,13:15'));
  assert.equal(result.preparedReview.profile.contact_email.value,'office@example.org'); assert.equal(result.preparedReview.websiteConfirmed,false);
  extraction.tables.push({...table,title:'Alternative Asr'});
  assert.equal(core.prepareExtraction(extraction,'2026-09','Europe/London').preparedReview.table,null);
  extraction.tables[0] = {...table,rows:[['1','','','','','','','']]};
  assert.equal(core.prepareExtraction(extraction,'2026-09','Europe/London').conversions[0].csv,null);
});
