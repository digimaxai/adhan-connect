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
  const existing = await db
    .from(table)
    .select("id")
    .eq("id", row.id)
    .maybeSingle();
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
  const mosque = await db
    .from("mosques")
    .select("id,name,city")
    .eq("id", mosqueId)
    .single();
  if (
    mosque.error ||
    mosque.data.city !== "Ruislip" ||
    !mosque.data.name.includes("Guidance")
  )
    throw Error("Mosque identity mismatch");
  await insertMissing("mosque_service_listings", {
    id: serviceId,
    mosque_id: mosqueId,
    title: "Islamic Studies Courses",
    category: "Education",
    kind: "course",
    status: "draft",
    description:
      "Study Arabic language, Quran reading with tafseer, Hadith, Fiqh and Islamic manners. The Guidance Centre offers Alimah and Alim courses to nurture knowledge, faith and character.",
    audience:
      "Girls and boys aged 12+; separate course options. Stage 2 requires completion of Stage 1.",
    location: "The Guidance Centre, 102 Victoria Road, Ruislip, HA4 0AL",
    action_type: "phone",
    action_value: "07817 364400",
    review_on: "2026-09-20",
  });
  const common = {
    service_id: serviceId,
    mosque_id: mosqueId,
    duration_text:
      "20 weeks (5 months); confirm teaching breaks with the mosque.",
    fee_text: "£45 per month",
    state: "upcoming",
    enrolment: "open",
    notes:
      "Contact Imam Shafiq about enrolment. Limited spaces were advertised; confirm current availability directly with the mosque.",
  };
  await insertMissing("mosque_service_intakes", {
    ...common,
    id: "c7a01600-0000-4000-8000-000000000011",
    title: "Alimah — Stage 1 · September 2026",
    audience: "Girls aged 12+",
    start_date: "2026-09-26",
    schedule: "Every Saturday, 9:00am–1:00pm (Europe/London).",
  });
  await insertMissing("mosque_service_intakes", {
    ...common,
    id: "c7a01600-0000-4000-8000-000000000012",
    title: "Alimah — Stage 2",
    audience: "Girls who have completed Stage 1",
    prerequisites: "Completion of Alimah Stage 1",
    start_date: null,
    schedule: "Confirm Stage 2 days and times with the mosque.",
    duration_text: "Confirm the Stage 2 duration with the mosque.",
    fee_text: "The poster advertises £45 per month; confirm Stage 2 fees.",
    enrolment: "contact",
    notes:
      "Stage 2 is listed on the poster. Confirm its start date, timetable and fee arrangements with Imam Shafiq before enrolment.",
  });
  await insertMissing("mosque_service_intakes", {
    ...common,
    id: "c7a01600-0000-4000-8000-000000000013",
    title: "Alim — Stage 1 · September 2026",
    audience: "Boys aged 12+",
    start_date: "2026-09-27",
    schedule: "Every Sunday, 9:00am–1:00pm (Europe/London).",
  });
  await insertMissing("campaigns", {
    id: "c7a01600-0000-4000-8000-000000000021",
    mosque_id: mosqueId,
    title: "Urgent community appeal — permanent centre",
    status: "paused",
    end_at: "2026-09-11T22:59:59Z",
    donation_url: "https://donate.stripe.com/5kAfZi48wgE7fqo003",
    description:
      "The Guidance Centre asked for support to secure its permanent community centre at 102 Victoria Road, Ruislip, HA4 0AL. The original appeal stated that £250,000 remained to be raised before 11 September 2026. That deadline has passed: this appeal is paused for review until the mosque confirms its current status and any revised deadline. The £250,000 figure is the remaining amount stated in the original appeal, not a verified overall target or current balance.\n\nDonations are made directly on the centre’s Stripe page. For enquiries: info@theguidancecentre.org. Registered charity number stated in the appeal: 1211060. Ask the centre about Gift Aid through its own donation process.",
  });
  await insertMissing("announcements", {
    id: "c7a01600-0000-4000-8000-000000000031",
    mosque_id: mosqueId,
    title: "Islamic Studies Courses — September intake",
    summary:
      "Explore Alimah and Alim course options for young people aged 12+. View the service for eligibility, timetable, fees and how to contact the centre.",
    status: "draft",
    is_pinned: true,
    is_urgent: false,
    related_service_id: serviceId,
  });
  console.log(
    "Guidance Centre review examples ready. No publication or notifications.",
  );
})().catch((error) => {
  console.error(error.message || "Seed failed");
  process.exitCode = 1;
});
