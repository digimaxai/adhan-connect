# Services, classes and external appeals — staging review

Implemented for the user's review on 16 September 2026. Production is unchanged.
Native releases use Xcode Cloud (iOS) and GitHub Actions (Android), not EAS Build.
EAS Hosting remains the web/API backend; preview deployment is `o3vmg41ymt`.
The user will perform visual/device QA.

## Review entry points

Select **Guidance Centre (Ruislip Community)** in the Local Admin workspace.

- **Services & classes → Islamic Studies Courses → Preview listing**: the service
  is a draft, with Alimah Stage 1, Alimah Stage 2 and Alim Stage 1 intakes.
- **Events / Campaigns / Notices → Campaigns → Urgent community appeal — permanent
  centre → Preview saved appeal**: the appeal is paused because its original
  11 September deadline has passed. The mosque must confirm updated wording and
  timing before activation.
- **Notices**: a draft September-course announcement links to the service.
  Publish the service before publishing its announcement.

The examples are transcribed from the user-supplied WhatsApp notices. No current
fundraising balance, exact course end date, total course fee, number of remaining
places or unconfirmed Stage 2 timetable is invented. The original image files
were not available as filesystem assets; the example text is seeded, and original
posters can be added using the existing attachment editor. Service posters are
shown uncropped in both the reader and admin preview.

## Behaviour

- Donations open the mosque's HTTPS collection URL. The app does not select amounts,
  process payments, receive funds, collect Gift Aid or claim payment success.
  Progress bars and collected-amount claims are removed from reader/admin campaign
  views. Historical amount columns are preserved for compatibility.
- Durable service listings support courses, regular drop-ins and appointments /
  enquiries. Each course intake has its own audience, entry requirements,
  dates, schedule, fee wording, activity state and enrolment availability.
- Courses remain discoverable after their start. Past end dates and enrolment
  deadlines close application actions; activity and enrolment are separate.
- Admins can create/edit, preview, duplicate intakes, archive services, attach
  posters/documents and set a review date. Overdue review dates appear in the
  admin list and editor; no automatic reminder messages are sent.
- Public services appear on mosque profiles. Courses with open intakes also appear
  on the primary mosque's follower homepage. Existing amenities remain in About.
- Contact actions support phone, email, verified-format HTTPS links, explicit
  international WhatsApp numbers and no-booking drop-ins. The provider confirms
  applications and payments. No children's enrolment records are collected.
- Notice-to-service links reuse a single source of course details.

## Data and permission checks

Migration: `20260916000100_services_and_external_appeals.sql`, applied to staging.
New tables: `mosque_service_listings`, `mosque_service_intakes`; additive columns:
`campaigns.donation_url`, `announcements.related_service_id`.

Row-level security hides drafts from public/listener reads, permits mosque-scoped
admin writes and denies cross-mosque writes. Composite foreign keys bind intakes
to the correct service and mosque. Attachment and notice parent checks prevent
cross-mosque associations. Attachments use the existing public flyer bucket;
never upload private application forms containing personal information.

Validation:

- `node scripts/services/test-rules.js`: URL validation, real calendar dates,
  London dates, start/end/deadline handling and contact actions.
- `python3 scripts/services/staging-review.py rehearse`: rolled-back migration.
- `python3 scripts/services/staging-review.py verify`: rolled-back public/listener
  visibility, owner CRUD and cross-mosque write checks.
- `node scripts/services/seed-guidance.js`: staging-only, insert-only stable example
  IDs; rerunning preserves admin edits and publishes nothing.
- TypeScript passed; lint has zero errors and six pre-existing warnings.
- Clean iOS, Android and web exports passed; client asset credential scan passed.

Existing iOS project, Info.plist, PrivacyInfo.xcprivacy and Podfile.lock changes
belong to the user and are excluded from this feature commit.
