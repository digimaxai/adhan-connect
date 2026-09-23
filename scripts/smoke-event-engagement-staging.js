const { load } = require('@expo/env');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
load(process.cwd());
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url || new URL(url).hostname !== 'zhrucqghrqkjyzmupdyy.supabase.co') throw Error('Staging only');
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE, opts);
const anon = createClient(url, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, opts);
const mosque = randomUUID(), event = randomUUID(), slot = randomUUID();
const users = [];
async function ok(p) { const r = await p; if (r.error) throw Error(r.error.message); return r.data; }

async function main() {
  try {
    await ok(admin.from('mosques').insert({ id: mosque, name: `Temporary engagement smoke ${mosque}`, status: 'pending', is_active: false, active: false }));
    await ok(admin.from('events').insert({ id: event, mosque_id: mosque, title: 'Temporary engagement smoke', start_at: new Date(Date.now() + 86400000).toISOString(), capacity: 2, status: 'published', is_public: true }));
    await ok(admin.from('mosque_jumuah_slots').insert({ id: slot, mosque_id: mosque, label: 'Smoke slot', salah_at: '13:30', capacity: 10 }));
    const clients = [];
    for (let i = 0; i < 2; i++) {
      const email = `engagement-${mosque}-${i}@example.com`, password = randomUUID() + randomUUID();
      const u = await ok(admin.auth.admin.createUser({ email, password, email_confirm: true }));
      users.push(u.user.id);
      await ok(admin.from('users').upsert({ id: u.user.id, email, role: 'user' }));
      const client = createClient(url, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, opts);
      await ok(client.auth.signInWithPassword({ email, password })); clients.push(client);
    }
    await ok(admin.from('mosque_admins').insert({ mosque_id: mosque, user_id: users[1] }));
    const anonView = await ok(anon.rpc('get_event_engagement', { p_event_id: event }));
    assert.equal(anonView.party_size, 0);
    assert.equal(anonView.attendees, undefined, 'listener-facing RPC must not expose aggregate attendees');
    const args = { p_event_id: event, p_action: 'attendance', p_value: 2 };
    const afterAttend = await ok(clients[0].rpc('set_event_engagement', args));
    assert.equal(afterAttend.party_size, 2);
    assert.equal(afterAttend.attendees, undefined, 'listener-facing RPC must not expose aggregate attendees');
    assert.ok((await clients[1].rpc('set_event_engagement', { ...args, p_value: 1 })).error);
    await ok(clients[0].rpc('set_event_engagement', { ...args, p_action: 'like', p_value: 1 }));
    await ok(clients[0].rpc('set_event_engagement', { ...args, p_action: 'favourite', p_value: 1 }));
    assert.ok((await clients[0].from('event_engagement').insert({ event_id: event, user_id: users[0], party_size: 8 })).error);
    assert.equal((await ok(clients[1].from('event_engagement').select('*'))).length, 0);
    const friday = new Date(); friday.setDate(friday.getDate() + (5 - friday.getDay() + 7) % 7);
    const date = `${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, '0')}-${String(friday.getDate()).padStart(2, '0')}`;
    await ok(admin.from('jumuah_attendance_intents').insert({ mosque_id: mosque, slot_id: slot, user_id: users[0], friday_date: date, party_size: 3 }));
    assert.ok((await clients[0].rpc('get_mosque_engagement', { p_mosque_id: mosque, p_friday_date: date })).error);
    const report = await ok(clients[1].rpc('get_mosque_engagement', { p_mosque_id: mosque, p_friday_date: date }));
    assert.equal(report.events[0].attendees, 2); assert.equal(report.events[0].likes, 1);
    assert.equal(report.events[0].favourites, 1); assert.equal(report.friday[0].attendees, 3);
    assert.equal((await ok(clients[0].rpc('set_event_engagement', { ...args, p_value: 0 }))).party_size, 0);

    // Jumu'ah attendance RPCs: listener sees only their own plan; capacity enforced server-side.
    const jArgs = { p_mosque_id: mosque, p_slot_id: slot, p_friday_date: date };
    const jBefore = await ok(clients[0].rpc('get_jumuah_attendance', { p_mosque_id: mosque, p_friday_date: date }));
    assert.equal(jBefore.attendee_count, undefined, 'listener-facing Jumuah RPC must not expose aggregate count');
    const jAfter = await ok(clients[0].rpc('set_jumuah_attendance', { ...jArgs, p_party_size: 4 }));
    assert.equal(jAfter.party_size, 4);
    assert.ok((await anon.from('jumuah_slot_attendance_summary').select('*').limit(1)).error, 'aggregate view must not be selectable by anon');
    assert.ok((await clients[0].from('jumuah_attendance_intents').insert({ mosque_id: mosque, slot_id: slot, user_id: users[0], friday_date: date, party_size: 1 })).error, 'direct table writes must be blocked');
    await ok(clients[0].rpc('set_jumuah_attendance', { ...jArgs, p_party_size: 0 }));

    console.log('PASS: staging attendance, capacity, reactions, privacy, local-admin event and Friday summaries.');
  } finally {
    const cleanupErrors = [];
    const clean = async p => { try { await ok(p); } catch (e) { cleanupErrors.push(e.message); } };
    await clean(admin.from('events').delete().eq('id', event));
    await clean(admin.from('mosque_jumuah_slots').delete().eq('id', slot));
    await clean(admin.from('mosque_admins').delete().eq('mosque_id', mosque));
    await clean(admin.from('mosques').delete().eq('id', mosque));
    for (const id of users) {
      await clean(admin.from('users').delete().eq('id', id));
      await clean(admin.auth.admin.deleteUser(id));
    }
    if (cleanupErrors.length) throw Error(`Fixture cleanup failed: ${cleanupErrors.join('; ')}`);
    console.log('Temporary staging records removed; no emails sent.');
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
