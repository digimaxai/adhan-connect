// One-off script: seed Guidance Centre mosque profile from website data.
// Run from the project root: node scripts/seed-guidance-centre.js
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE — check .env.local / .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: results, error: findError } = await supabase
    .from('mosques')
    .select('id, name, city')
    .ilike('name', '%Guidance%')
    .limit(5);

  if (findError) { console.error('Find error:', findError.message); process.exit(1); }
  if (!results || results.length === 0) { console.error('No mosque found matching "Guidance".'); process.exit(1); }

  console.log('Found candidates:');
  results.forEach((m) => console.log(`  ${m.id}  ${m.name}  (${m.city ?? '—'})`));

  const mosque = results.find((m) => m.city?.toLowerCase().includes('ruislip') || m.name?.toLowerCase().includes('ruislip')) ?? results[0];
  console.log('\nUpdating:', mosque.name, '—', mosque.id);

  const patch = {
    description: "The Guidance Centre is an Islamic community centre dedicated to upholding an Islamic identity and establishing a strong Muslim community based on Quranic principles and the teachings of the Prophet Muhammad ﷺ. Serving the people of Ruislip and surrounding areas, the centre provides worship, education, counselling, and community support.",
    address_line1: '102 Victoria Road',
    address_line2: null,
    city: 'Ruislip',
    postcode: 'HA4 0AL',
    contact_email: 'info@theguidancecentre.org',
    contact_phone: null,
    website: 'https://theguidancecentre.org',
    management_info: 'Trustee & Counsellor: Asjad Rahman (20+ years in Islamic community development).',
    services: [
      "Friday Jumu'ah Prayer",
      'Daily congregation prayers (5 daily)',
      'Eid prayers',
      'Islamic education / Madrasah',
      'Quran classes',
      "Women's prayer area",
      'Youth programs',
      'Convert / new Muslim support',
      'Wedding ceremonies (Nikah)',
    ],
  };

  const { error: updateError } = await supabase
    .from('mosques')
    .update(patch)
    .eq('id', mosque.id);

  if (updateError) {
    console.error('Update error:', updateError.message);
    process.exit(1);
  }

  console.log('Done. Mosque profile updated successfully.');
}

main().catch((e) => { console.error(e); process.exit(1); });
