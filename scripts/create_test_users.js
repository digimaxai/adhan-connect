// scripts/create_test_users.cjs
// Guard: if somehow bundled in RN, exit immediately
if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
  throw new Error('This script must be run with Node, not inside the app.');
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;            // e.g. https://xyz.supabase.co
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; // NEVER put in Expo env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const accounts = [
  { email: 'admin+test@adhanconnect.local', password: 'AdminTest!234', display_name: 'Admin Test', role: 'main_admin' },
  { email: 'muezzin+test@adhanconnect.local', password: 'MuezzinTest!234', display_name: 'Muezzin Test', role: 'user' },
  { email: 'user+test@adhanconnect.local', password: 'UserTest!234', display_name: 'User Test', role: 'user' },
];

(async () => {
  for (const a of accounts) {
    const { data, error: createErr } = await supabase.auth.admin.createUser({
      email: a.email,
      password: a.password,
      email_confirm: true,
      user_metadata: { display_name: a.display_name },
    });
    if (createErr) { console.error('create user error', a.email, createErr); continue; }
    const user = data.user;
    console.log('Created auth user', a.email, 'id=', user.id);

    const { error: profErr } = await supabase
      .from('users')
      .upsert({ id: user.id, email: a.email, display_name: a.display_name, role: a.role }, { onConflict: 'id' });
    if (profErr) console.error('profile upsert error for', a.email, profErr);

    if (a.role === 'main_admin') {
      const { data: mdata, error: mErr } = await supabase
        .from('mosques')
        .insert({ name: 'Test Mosque (Admin)' })
        .select()
        .single();
      if (!mErr && mdata) {
        await supabase.from('mosque_admins').insert({ mosque_id: mdata.id, user_id: user.id, role: 'owner' });
        console.log('Assigned admin to mosque', mdata.id);
      }
    }
  }
  console.log('Done.');
  process.exit(0);
})();
