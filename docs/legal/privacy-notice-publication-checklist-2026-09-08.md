# Privacy notice publication checklist

Applies to `privacy-notice-simplified-draft-2026-09-08.md`.

This is an internal checklist, not part of the public notice. The draft simplifies
language without claiming compliance has been established. No notice provides
immunity from claims or overrides statutory rights. Do not publish until the
specific facts and proposed legal bases below have been checked.

1. **Release scope and identity.** Add the effective date and company contact
   address; confirm the operator's legal identity and that privacy@adhanconnect.app
   is monitored. This draft now targets the planned no-sign-up listener release, as clarified
   by the owner on 9 September. Publish its no-sign-up statements only once
   implemented and tested. Confirm the exact registered name of Maksums Ltd
   against Companies House; Maksums Digital Agency is a trading name, not a
   separate legal operator. Include the required company disclosures on the
   company website (registered name, number, registered office and jurisdiction). Accountless
   listeners still require accurate identifier, location, retention and rights
   disclosures. Do not delete existing named listeners merely to match wording.
2. **Legal bases.** The table is a proposed allocation for legal review, not a
   verified organisational decision. Validate contractual necessity for each
   service, document the legitimate-interests assessment where needed and align
   consent with actual optional controls. Validate a separate Article 9 condition
   for data that actually reveals religion, assessing prayer-attendance records,
   staff roles and retained records separately from straightforward mosque follows.
   Do not impose religious-data consent on every follow merely because the
   organisation is a mosque. Verify that the app does not infer religious identity
   or target people on that basis. Document the UK assessment and separately
   confirm the EU position for the planned markets.
   Staff consent may not be freely given where a mosque requires use for work;
   obtain advice on that relationship rather than assuming a checkbox suffices.
   Staff duty/rota information can reveal more than religion (for example health
   details in free-text absence reasons); minimise it and assess any extra condition.
3. **Consent and rights.** Prove refusal and withdrawal enforcement, direct API/RLS
   access and the request-handling workflow. Acknowledging a privacy notice is not
   consent. Validate manual requests even if in-app deletion is unavailable.
   Meet statutory response requirements; organisational inconvenience is not an
   automatic ground for refusing erasure. For the no-sign-up release, implement
   secure session-based export/deletion and lost-credential handling first.
4. **Retention.** Approve and implement a schedule for each category: accounts,
   attendance, reactions, push tokens/deliveries, saved travel areas, staff history,
   content, consent, logs, support and backups. The draft gives criteria, which
   must describe actual practice. Prefer meaningful periods where established.
   Travel-alert expiry is not evidence of deletion. Do not invent deadlines or
   promise uninstall-triggered deletion. Validate backup expiry and legal holds.
5. **Providers and transfers.** Verify deployed services, regions, data flows,
   contracts and subprocessors. Complete the transfer paragraph using the actual
   adequacy decisions or UK IDTA/Addendum and any necessary assessment. Check
   email (including Resend if active), website/support (including Vercel and
   Web3Forms if in scope), authentication providers and diagnostics. The generic
   categories in the draft are not a substitute for knowing your recipients.
   Verify recording settings with each broadcast provider before promising that
   audio is never recorded. Agree controller/processor responsibilities with mosques.
6. **Children and release validation.** Complete the Children's Code applicability
   and DPIA screening; 16–17-year-olds are still children and an age statement
   alone does not establish compliance. Assess any proposed guest access before
   release. Review storage/SDK tracking under applicable PECR rules and align app
   store disclosures. Verify admin visibility and public-content permissions in
   each deployed environment. Keep the notice accessible before collection.

## Sources checked 8 September 2026

- ICO, required privacy information:
  https://ico.org.uk/for-organisations/advice-for-small-organisations/getting-started-with-gdpr/data-protection-self-assessment/what-information-you-must-supply-under-the-gdpr/
- ICO, Article 6 and Article 9 requirements:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-are-the-rules-on-special-category-data/
- ICO, appropriate use of consent:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/when-is-consent-appropriate/
- ICO, UK transfer safeguards:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/
- ICO, Children's Code:
  https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/faqs-on-the-15-standards-of-the-children-s-code/

Engineering references: `docs/legal/adhan-connect-data-map.md`,
`docs/auth/listener-no-login-review-2026-09-08.md`, account consent/withdrawal and
deletion code, and the September 2026 notification migrations. Historical
inventories do not prove live provider configuration or complete compliance.

No terms of use were changed. Liability, acceptable use and service expectations
should be addressed in the separate terms review, subject to applicable law.

## Wording update — 9 September 2026

The public draft now addresses people as “you” and uses “mosque staff” when
role-specific distinctions matter. It describes providers by their service
categories rather than product names. Keep the named provider inventory and
contracts internally; this editorial simplification does not remove provider,
transfer or rights-response obligations. Check that categories accurately cover
all recipients and remain meaningful to users.

ICO permits naming recipients or describing their categories in a notice:
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/

## Risk-assessment follow-up — 9 September 2026

Read `uk-eu-risk-assessment-2026-09-09.md` alongside both drafts. The revised
terms now require reporting/review operations, proportionate enforcement and
pre-use presentation; these are not implemented by writing the document. Confirm
the email inbox is monitored and equipped for urgent broadcast reports. A basic
email route may not fulfil every applicable DSA or Online Safety Act requirement.
Complete the service classification and statutory processes first.

Validate the privacy draft's explicit-consent allocation and limited Article 9
legal-claims retention separately. Add any actual automated moderation/decision
processing if introduced; do not describe tools that do not exist. Obtain a
separate mosque agreement where institutional permissions, controller duties,
service levels and business liability need allocation. Review UK/EU consumer
contract formation, applicable digital-service withdrawal/remedies and launch
markets before enabling agreement screens. Keep terms acceptance, privacy notice
acknowledgement and special-category consent distinct.

The revised terms replace the previous blanket warranty exclusion, staff
indemnity, unconditional content disclaimer and exclusive English-court wording.
Do not restore those clauses simply because a large platform uses similar words
in a different jurisdiction or business contract.

## Mosque follows clarification — 9 September 2026

The public documents now describe following as a choice about mosque updates,
not a declaration of faith, membership or attendance. This does not remove
ordinary personal-data obligations for session-linked preferences. It also does
not resolve the classification of prayer-attendance records or staff roles.

The ICO's place-of-worship example distinguishes activity which does not itself
clearly reveal beliefs from processing intended to infer beliefs or treat people
differently on that inferred basis. Assess the actual purpose and context, not
just the absence of a religion field. Do not treat this UK guidance as an EU-wide
exemption or remove existing consent controls without a separate implementation
and legal review.

Source: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/#what-about-inferences

## Pillars tone comparison — 9 September 2026

The privacy draft now groups information around remembering mosques, finding
nearby mosques, notifications, support and staff duties. The terms use warmer
introductions and a plain-language attendance explanation. Wording is original.

Pillars' published privacy notice and terms were reviewed as tone/structure
references, not evidence of legal compliance or of Adhan Connect's behaviour:

- https://www.thepillarsapp.com/privacy (labelled August 2026)
- https://www.thepillarsapp.com/terms (labelled March 2025)

No claims of wholly anonymous data, exclusively on-device location processing,
optional analytics controls or uninstall-triggered server deletion were imported.
No broad indemnity, perpetual content licence or compulsory arbitration was added.
The feature descriptions still require validation for the planned release.
