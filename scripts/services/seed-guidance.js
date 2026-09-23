// Idempotent, insert-only staging examples transcribed from user-provided notices.
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const env = require("dotenv").parse(fs.readFileSync(".env.local.staging"));
const ref = "zhrucqghrqkjyzmupdyy";
const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
if (new URL(url).hostname !== `${ref}.supabase.co`) throw Error("Staging only");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE.trim(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const mosqueId = "2b434f46-fc2d-42aa-815b-bffa0a0aad26";
const serviceId = "c7a01600-0000-4000-8000-000000000001";
async function insertMissing(table, row) {
  const existing = await db.from(table).select("id").eq("id", row.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    console.log(table, "already exists; kept admin edits");
    return;
  }
  const result = await db.from(table).insert(row);
  if (result.error) throw result.error;
  console.log(table, "example created");
}
(async () => {
  const mosque = await db.from("mosques").select("id,name,city").eq("id", mosqueId).single();
  if (mosque.error || mosque.data.city !== "Ruislip" || !mosque.data.name.includes("Guidance")) throw Error("Mosque identity mismatch");

  await insertMissing("mosque_service_listings", {
    id: serviceId,
    mosque_id: mosqueId,
    title: "Islamic Studies Courses",
    category_key: "alim_alimah",
    status: "draft",
    description:
      "Arabic language, Qur'an reading with tafseer, Hadith, Fiqh and Islamic manners. Alimah courses for girls and Alim courses for boys, nurturing knowledge, faith and character. 20 weeks (5 months). Limited spaces — contact Imam Shafiq.",
    audience_key: "children",
    age_note: "aged 12+",
    location: "The Guidance Centre, 102 Victoria Road, Ruislip, HA4 0AL",
    days: ["sat", "sun"],
    time_from: "09:00",
    time_to: "13:00",
    start_date: "2026-09-26",
    fee_text: "£45 per month",
    taking_enrolments: true,
    action_type: "phone",
    action_value: "07817 364400",
  });
  const common = { service_id: serviceId, mosque_id: mosqueId, time_from: "09:00", time_to: "13:00", fee_text: "", taking_enrolments: true, note: "" };
  await insertMissing("mosque_service_intakes", { ...common, id: "c7a01600-0000-4000-8000-000000000011", title: "Alimah — Stage 1", audience_note: "Girls aged 12+", days: ["sat"], start_date: "2026-09-26" });
  await insertMissing("mosque_service_intakes", {
    ...common,
    id: "c7a01600-0000-4000-8000-000000000012",
    title: "Alimah — Stage 2",
    audience_note: "Girls who completed Stage 1",
    days: [],
    time_from: null,
    time_to: null,
    start_date: null,
    taking_enrolments: false,
    note: "Dates, times and fees for Stage 2 to be confirmed with the mosque.",
  });
  await insertMissing("mosque_service_intakes", { ...common, id: "c7a01600-0000-4000-8000-000000000013", title: "Alim — Stage 1", audience_note: "Boys aged 12+", days: ["sun"], start_date: "2026-09-27" });

  await insertMissing("campaigns", {
    id: "c7a01600-0000-4000-8000-000000000021",
    mosque_id: mosqueId,
    title: "Urgent community appeal — permanent centre",
    status: "paused",
    end_at: "2026-09-11T22:59:59Z",
    donation_url: "https://donate.stripe.com/5kAfZi48wgE7fqo003",
    description:
      "The Guidance Centre needs your support to secure its permanent community centre at 102 Victoria Road, Ruislip, HA4 0AL. The original appeal stated £250,000 remained to be raised before 11 September 2026; the mosque will confirm the current position and any revised deadline. Every donation, large or small, can become a lasting Sadaqah Jariyah.\n\nDonations are made directly on the centre's own secure page. Enquiries: info@theguidancecentre.org.",
  });
  await insertMissing("announcements", {
    id: "c7a01600-0000-4000-8000-000000000031",
    mosque_id: mosqueId,
    title: "Islamic Studies Courses — September intake",
    summary: "Alimah and Alim courses for young people aged 12+. Saturdays (girls) and Sundays (boys), 9am–1pm from 26/27 September. Tap to see details and how to enrol.",
    status: "draft",
    is_pinned: true,
    is_urgent: false,
    related_service_id: serviceId,
  });
  console.log("Guidance Centre review examples ready. No publication or notifications.");
})().catch((error) => {
  console.error(error.message || "Seed failed");
  process.exitCode = 1;
});
