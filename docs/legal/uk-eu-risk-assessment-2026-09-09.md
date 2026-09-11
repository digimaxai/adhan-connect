# Adhan Connect — UK and EU legal risk assessment

Date: 9 September 2026. Internal working assessment, not a legal opinion or a completed statutory risk assessment. No publication or product deployment is authorised by this document alone.

## Scope and conclusion

Assessed the existing terms, the revised privacy draft, the personal-data map, the no-sign-up architecture proposal, API routes, notification/attendance migrations and the security work recorded in this thread. Provider contracts, corporate records, insurance, all production configurations and actual moderation operations were not audited. Country-specific EU implementation remains to be assessed for intended launch markets.

The intended service supports prayer times, mosque profiles/follows, live Adhan, events, campaigns, attendance intentions, notifications, geographic discovery and staff administration. Related code includes Quran/audio resources, schedule imports, content attachments and a mosque-assistant publishing workflow. Their rights and publication controls belong in scope when enabled. Ordinary people will not need named registration; staff and platform administrators retain protected accounts. That future experience is not yet established by the reviewed code.

The app has fewer interaction channels than a general social network, but this does not establish a legal exemption. Religious associations, children, live audio and mosque-originated uploads are the important exposures. Removing named registration is useful minimisation, not removal of personal-data obligations. The two Supabase findings have been remediated; that does not certify every access policy or establish absence of historical misuse.

Ratings below are qualitative priorities based on plausible harm and implementation uncertainty, not measured probabilities. P0 means resolve before the affected feature/release; P1 means address before broader rollout. Wording reduces misunderstanding but does not eliminate operational duties.

## Risk register

| Priority | Feature and plausible challenge | Contract/privacy response | Required operational protection and owner |
| --- | --- | --- | --- |
| P0 / High | Prayer-attendance records and staff roles may reveal religion; straightforward mosque follows require a separate contextual assessment. Device IDs remain linkable. Invalid consent or cross-mosque access could cause privacy claims or enforcement. | Explain pseudonymous sessions, purposes and recipients; apply Article 9 where the processing warrants it, not automatically to every follow. No claim that voluntary use alone is explicit consent. | Operator/legal: validate conditions per purpose and staff relationship; engineering: genuine consent, refusal/withdrawal, tenant isolation, minimum logs, DPIA assessment. Do not assume a commercial operator qualifies for a religious nonprofit exception. |
| P0 / High | Children use public features; a 16+ staff gate does not address them. Religious/location data can compound harm. | Remove assertions that no age data means no child obligations. Keep age design as a launch decision, not a waiver. | Operator/legal: Children’s Code and DPIA assessment; risk-appropriate age approach, child-friendly explanations, high privacy defaults. Assess UK Article 8 and relevant EU national consent ages where consent is relied on; do not assume a single EU age. |
| P0 / High | Compromised muezzin/admin broadcasts abuse, illegal speech or private conversations; uploads contain unlawful material. | Specific prohibited content, reporting, urgent interruption/removal, reasons and review. No blanket “not our responsibility” clause. | Safety/engineering: verify mosque authority, strong staff authentication, revoke publishers and stop active streams, reporting tied to mosque/time/content, monitored escalation and evidence minimisation. |
| P0 / High | UK Online Safety Act scope overlooked because only mosque staff publish. | Terms support rules and complaints, but cannot create an exemption. | Legal/operator: complete and record Ofcom scope and risk assessments. Staff at independent mosques can still be users publishing to other users; one-to-many audio is not the one-to-one live-audio exclusion. Evaluate exemptions against actual service relationships. If in scope, implement applicable illegal-content, children’s assessment, reporting and complaints duties. [Ofcom checker](https://www.ofcom.org.uk/os-toolkit/regulation-checker/regulation-checker). |
| P0 / High if EU offered | Hosting public mosque content may engage the EU DSA. Ignoring a sufficiently specific illegal-content notice can increase liability exposure. | Accessible notice channel, explained restrictions, review process; do not assert unconditional hosting immunity. | Legal/operator: assess territorial scope and hosting/online-platform classification. Check Articles 11–17, applicable notice/action and reasons duties, legal representation if no EU establishment, and relevant platform obligations. Small/micro exemptions are provision-specific, not a complete exemption; no assumption that VLOP duties apply. [DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj?locale=en). |
| P0 / High | Deletion/export promised but anonymous credential lost, staff handover blocks deletion or records persist after uninstall. | Explain verification, server retention and lawful exceptions; no uninstall-deletion promise. | Engineering/privacy owner: session-based deletion/export, documented recovery limitations, manual rights channel, timed retention and backups. Staff inconvenience cannot indefinitely override rights. |
| P0 / High | Overbroad exclusions, perpetual content licence, unlimited personal indemnity or forced English courts prove unfair. | Foreseeability-based consumer clause, statutory carve-outs, service-limited licence, no blanket consumer/staff indemnity, home-court protections. | Legal/product: prominent pre-use terms and demonstrable acceptance at relevant feature boundaries; no bundled privacy consent. Review paid features separately. [CMA guidance](https://www.gov.uk/guidance/writing-a-fair-contract-for-customers). |
| P1 / Medium–High | Incorrect prayer time, DST, timezone or imported schedule causes missed prayer/fasting confusion; push fails to arrive. | Explain timetable sources, calculation uncertainty and delivery limitations; no exclusion of responsibility for our own actionable fault. | Engineering/mosque: timezone/source/method and freshness display, mosque review of imports, correction channel, stale-data checks. Notifications are not guaranteed alarms or emergency communications. |
| P1 / Medium–High | Attendance count interpreted as a ticket or safe venue capacity; duplicated anonymous sessions distort counts. | Intention only, no admission guarantee, organiser controls access. | Product/mosque: identical warning at confirmation; transactionally enforce app limits; prevent obvious duplicate abuse. Never present estimated counts as occupancy certification or emergency roll-call data. |
| P1 / Medium–High | Audio, Quran recordings, photos, logos or event PDFs infringe copyright/performer/privacy rights. | Publisher authority warranty, limited hosting/transmission licence, infringement reporting. | Content owner: rights inventory for every supplied recitation/translation/recording and feed; provider permission is not automatically content permission. Mosque: inform people before broadcasting and avoid incidental private audio. |
| P1 / Medium–High | False affiliations, defamatory notices or fraudulent donation links damage people or misdirect funds. | Ban impersonation, defamation, scams and misleading campaigns; identify organiser and external transaction. | Operator: mosque verification and disputed-control process; content reports and urgent link removal. No claim of donation verification without checks. If payment collection starts, separately assess payments, fundraising, refunds, sanctions and platform rules; terms alone do not authorise regulated activity. |
| P1 / Medium | Mosque-assistant/import workflow publishes wrong times or personal data from uploaded documents. | Staff review before publication; accountability for authorised publishing. | Engineering/staff: preview, explicit approval, audit trail and rollback. Identify any external AI/OCR processors before sending documents; neither their use nor compliance is established here. |
| P1 / Medium–High | Provider transfers, logs, notification text or saved travel regions exceed the notice. | Specific provider categories and transfer disclosure; no “never logged/recorded” guarantee. | Privacy/engineering: actual provider/region/contract inventory, UK and EU transfer analysis, token expiry, location retention, lock-screen notification minimisation. Review SDK/device-storage rules under PECR and relevant EU ePrivacy laws. |
| P1 / Medium | Mosque staff assume roles are employment contracts or authority to bind the mosque; disputed account takeover or volunteer departure. | Authorised use only, reasonable credential care, proportionate suspension and handover. | Operator/mosque: separate organisational agreement covering authority, controller/processor roles, retention, broadcast permissions and service expectations. Do not treat every volunteer as a business customer or automatically personally liable. |
| P1 / Medium | Inaccessible interfaces, misleading “no data” promises, unfair exclusion or unlawful discrimination. | Plain language, accessible reporting, accurate feature claims, retained mandatory rights. | Product/legal: accessible notice and controls; assess Equality Act duties and EU accessibility obligations for the actual service and markets, including any applicable exemptions. Measure real accessibility rather than claim certification. |
| P1 / Medium | Outage, hack or abrupt closure causes claims; response misses notification obligations. | Reasonable care, proportionate changes with notice and preservation of remedies. | Security/operator: incident plan, restore tests, processor escalation, breach notification assessment (including applicable 72-hour authority deadline), access reviews and appropriate cyber/professional insurance. |

## What established platforms teach us

We reviewed their own UK/European terms, not US templates, and drafted original clauses. These companies’ wording is not proof of enforceability for this app.

- **[YouTube UK terms](https://www.youtube.com/t/terms?gl=GB):** separates user rights, upload permissions, content restrictions, enforcement and responsibility. Adapt the separation and reasoned enforcement. Do not import broad business-facing limits into terms for individuals or copy its expansive promotional licence.
- **[TikTok EEA/UK/Swiss terms](https://www.tiktok.com/legal/page/eea/terms-of-service/en):** distinguishes accountless access, privacy information, content rules and reasons for restrictions. Adapt those structures. Its advertising, recommender systems, monetisation and large-platform machinery are not Adhan Connect features. Its regional supplementary terms also show why one global waiver is inadequate.
- **[CMA guidance](https://www.gov.uk/guidance/writing-a-fair-contract-for-customers):** the useful protection is a clear, fair allocation of responsibilities. Remove US-style warranty jargon, unrestricted unilateral changes and an unlimited indemnity for every staff user.

## Revised documents and remaining decisions

The revised public-facing documents are:

- `privacy-notice-simplified-draft-2026-09-08.md`: future no-sign-up model, direct “you” language, provider categories, qualified religious-data consent, reporting records, explicit objection right, transfer/retention completion required.
- `terms-of-use-draft-2026-09-08.md`: replaced with original UK/EU-oriented terms covering broadcasts, timetable reliance, attendance, moderation, IP, account authority, fair changes and consumer liability. Privacy acknowledgement is separate from contractual acceptance and explicit consent.

Do not publish draft headers or unresolved placeholders. The mailbox, reporting/review promises, staff consent and no-sign-up statements must match tested reality. No code or operational control was added by this legal-document task.

Before launch, assign a named owner and evidence to each P0 item. Particularly:

1. Confirm exact registered company name, address, number and jurisdiction; clarify the mosque agreement and controller allocation.
2. Validate Article 6/9 bases, retention and actual UK/EU transfer safeguards; complete DPIA/children and OSA/DSA scope decisions.
3. Implement report intake, live interruption, complaint review, consent/rights controls and accessible terms presentation.
4. Confirm external-content licences, location/log behaviour and approved launch countries. Review whether EU GDPR Article 27 representation is required separately from DSA representation.
5. Have UK counsel and, where appropriate, counsel for initial EU markets review the completed facts, particularly staff consent and organisational liability. A negotiated mosque agreement can address organisational losses; no unsupported numerical liability cap has been invented here.

## Additional legal sources

- [ICO Article 6 and Article 9](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/).
- [ICO children's lawful bases](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/annex-c-lawful-basis-for-processing/).
- [European Commission digital-contract rules](https://commission.europa.eu/topics/business-and-industry/contract-rules/digital-contracts/digital-contract-rules_en): some free services involving personal data can fall within digital-service consumer rules. Assess the exceptions for data processed solely to supply the service or meet legal duties; no automatic conclusion that all free apps are covered.
- [ICO recipient categories](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/).

Sources accessed 9 September 2026. This is a scoped legal-risk review, not proof that every listed law applies or a guarantee against litigation.

## Clarification following review of mosque follows

A follow can simply request prayer times, events, campaigns and community updates.
The revised notice and terms do not describe it as establishing religious beliefs,
interests, membership or attendance. Under the ICO inference guidance, distinguish
information that itself clearly reveals beliefs from an intention to infer beliefs
or treat people differently on that inferred basis. A mosque-updates preference
is not automatically subject to Article 9 solely because someone could guess a
belief from it. Privacy safeguards still apply, including against third-party
inferences. Assess prayer attendance and staff roles separately and confirm EU
classification independently before release. No existing technical consent gate
has been removed by this drafting change.

[ICO inference guidance, checked 9 September 2026](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/#what-about-inferences).
