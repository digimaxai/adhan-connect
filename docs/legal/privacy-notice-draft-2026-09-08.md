# Adhan Connect Privacy Notice

**Draft prepared 8 September 2026 — for legal review before publication.**
**Not yet published in the app or on any website.**

Effective date: [to be set on publication]

## Before you rely on this document

This is a professionally structured working draft, not a finished legal
instrument. Three things must happen before it is accurate enough to
publish:

1. **A qualified lawyer must review it** against your actual entity structure,
   insurance, and jurisdiction-specific obligations (this draft assumes England
   & Wales / UK GDPR as the primary framework, based on Maksums Limited's
   registered status, and is not adapted for any other jurisdiction you
   might use the app from).
2. **The engineering described below must be built before this notice goes
   live.** As of this draft, Adhan Connect's attendance-planning,
   push-notification, and mosque-follow features are implemented against an
   authenticated user account (`auth.uid()`), and live-stream playback
   grants are described in the engineering documentation as
   "account-bound." This notice describes the destination — an everyday
   app experience that never requires an account — not the system as it
   stands today. Publishing this notice before that work lands would make
   it inaccurate, which is its own compliance problem.
3. **The specific technical approach must be confirmed and matched to this
   wording.** This draft describes "no account, ever" using the anonymous-
   session architecture set out in
   `docs/auth/listener-no-login-review-2026-09-08.md` — a persistent,
   unnamed Supabase authentication session created automatically per
   installation, not a fully identifier-free design. That review is itself a
   proposal, not an implementation, and flags several unresolved points this
   notice inherits: the Article 6/Article 9 legal basis for attendance and
   follow data is not yet confirmed, the existing 16+ age gate has not yet
   been reassessed for an accountless flow, and a Children's Code/DPIA
   screening is still outstanding. If the eventual implementation diverges
   from that architecture (for example, a fully sessionless design with no
   persistent identifier at all), this notice's wording — particularly
   Sections 4.2 and 4.6 — needs to be re-checked against whatever is
   actually built, not assumed to still apply.

See `docs/legal/adhan-connect-data-map.md` for the underlying engineering
inventory this notice is built from, and the open questions it still flags
(controller/processor status between Maksums Limited and individual mosques
is one that legal counsel should resolve before publication).

---

## 1. Who we are

Adhan Connect is a product developed and operated by **Maksums Limited**,
trading as **Maksums Digital Agency** ("we", "us", "our"), a company
registered in the United Kingdom.

For any question about this notice, or to exercise a privacy right described
below, contact:

**privacy@adhanconnect.app**

## 2. Our approach in plain terms

Most apps are built around collecting an account, then figuring out what
privacy promises to layer on top. We built Adhan Connect the other way
round: the everyday experience — prayer times, live Adhan, following
mosques, community notices, event and Jumu'ah attendance planning — is
designed to work **without you ever creating an account, giving us your
name, or providing an email address.**

We are not in the business of collecting personal data. Where the app does
need a small amount of technical information to function — for example, so
your phone can receive a notification, or so we can show you mosques near
you — we collect the minimum necessary, we do not tie it to your identity,
and we tell you exactly what it is below. There is no advertising, no data
brokerage, and no sale of personal data in this app, for anyone, in any
capacity.

A smaller number of people also hold a role at a mosque — muezzins, local
admins, and main admins — and use a separate, account-based part of the app
to do their jobs (managing prayer times, rotas, broadcasts, and content).
That part of the service necessarily involves an account and more
conventional data handling, described in Section 5.

## 3. Who this notice applies to

This notice is written for you, using Adhan Connect to follow mosques,
view prayer times, listen to live Adhan, browse events and community
content, and plan attendance — which is what almost everyone using the app
does. Section 4 describes exactly what that involves, and applies to you.

A smaller group of people also hold a role at a mosque: muezzins, local
admins, and main admins, who sign in to carry out that role. If that's
you, Section 5 applies in addition to Section 4 — taking on a mosque role
adds an account and the data that comes with it, but does not change how
the everyday parts of the app work for you.

## 4. Using Adhan Connect

### 4.1 No account, ever

You do not need to sign up, log in, provide your name, provide an email
address, or verify a phone number to:

- view prayer times for any mosque;
- listen to a live Adhan broadcast;
- browse mosque profiles, events, campaigns, and community notices;
- follow up to three mosques, so the app remembers your preferences;
- plan attendance at an event or Friday Jumu'ah prayer, and choose to
  cancel that plan;
- receive a push notification about a followed mosque going live, or an
  upcoming prayer reminder you have chosen to enable.

### 4.2 What we do process, and why

Even without an account, a small amount of technical data passes through
the app for it to function. This is genuinely minimal, and none of it is
designed to identify you personally.

| What | Why | Where it lives |
| --- | --- | --- |
| Your followed mosques and notification preferences | So the app remembers what you're interested in, and can tell your phone when something relevant happens | On your device, and against an anonymous session identifier on our server that carries no name, email, or password |
| A device push-notification token | So your phone (via Apple or Google's push service) can receive an alert you've asked for | Our server, associated only with the anonymous session identifier above |
| Your device's approximate location, only while the app is open and only if you allow it | To show you mosques near you, and to let you optionally enable "nearby live Adhan" alerts for a small area around you | Processed on your device and in the request to our server; not stored longer than needed to answer that request, and never written into logs or URLs |
| An attendance plan for an event or Jumu'ah slot (e.g. "I'm coming, party of 2") | So the mosque can gauge expected numbers and manage capacity | Held against the anonymous session identifier, visible in aggregate to the mosque's administrators (a number, not your identity), never shown to anyone else using the app |
| Standard technical logs (IP address, request timing, error codes) generated by any app talking to a server | Security, abuse prevention, and fixing things when they break | Our infrastructure providers' standard logging, kept only as long as needed for that purpose |

We want to be precise about what "anonymous" means here, rather than
overstate it. Behind the scenes, the app creates an anonymous session with
our authentication provider (Supabase) the first time it needs one — this
gives your installation a stable identifier so your follows and
preferences survive between app launches. That identifier is never given a
name, email address, password, or any other detail that identifies you,
and we do not attempt to work out who you are from it. But it is, by
design, persistent — that is precisely what lets the app remember your
preferences — not a one-time or disposable value.

We deliberately do not collect your name, your email address, your phone
number, your exact home address, or a persistent profile of your movements.
Under data protection law, however, a persistent identifier like this is
still "pseudonymous" personal data, not information that is legally
anonymous — so your rights around it, described in Section 4.6 below,
still apply, even though we hold nothing that identifies you by name.

### 4.3 Attendance planning and sensitive inference

We want to be direct about something many privacy notices gloss over.
Knowing that a specific device followed a specific mosque, or plans to
attend Jumu'ah prayer there, can reveal something about a person's religious
practice — even without a name attached. Under UK and EU data protection
law, this is treated as a more sensitive category of information.

Because this information is never linked to your identity, and because you
choose what to follow and what attendance plans to make, our starting
position is that this is information you have voluntarily and knowingly
shared for a specific, narrow purpose (helping a mosque plan for a service
or event), and we do not use it for anything else — no profiling, no
advertising, no sharing with anyone other than the relevant mosque's own
administrators in aggregate form. Whether that voluntary sharing amounts to
the specific lawful basis data protection law requires for this category
of information is a legal question we confirm before this notice is
published, not one we consider settled by this description alone.

### 4.4 What mosque administrators can see

A mosque's local and main administrators can see aggregate attendance
numbers for their own events and Jumu'ah slots (for example, "14 people,
5 parties, plan to attend"). They cannot see who those people are — nobody
using the app this way has an identity in our system for mosque staff to
see.

### 4.5 If you choose to enable notifications

Enabling notifications registers your device's push token with our server
and Apple's or Google's push notification service, so we can deliver an
alert. You can turn this off at any time in Settings, on your device, or by
uninstalling the app. Declining or disabling notifications does not affect
any other part of the app.

### 4.6 Your rights

Because there is no account to log into, we exercise your data rights at
the level of your device's anonymous session rather than an identity
lookup. From Settings, you can see what your session holds (followed
mosques, notification preferences, active attendance plans) and clear it
entirely — this deletes the associated records on our server, not just the
copy on your device. Uninstalling the app achieves the same result, since
nothing survives that is tied to anything but the session itself.

If you would like a copy of what's held against your session before
clearing it, or you're unable to use the in-app control for any reason,
email privacy@adhanconnect.app. Because we do not hold anything that
identifies you, we cannot verify a request by name or email in the way we
would for a mosque staff account — we will describe a workable
verification approach here once it is finalised.

## 5. If you hold a role at a mosque (muezzin, local admin, or main admin)

Carrying out a role at a mosque — leading or managing prayer broadcasts,
scheduling, rotas, or content — requires an account, because the work
itself requires knowing who is doing it (for accountability, scheduling,
and, where relevant, safeguarding).

### 5.1 What we collect

- **Account details**: your name, email address, and authentication
  information (we never see or store your password itself — this is
  handled by our authentication provider, Supabase, using industry-standard
  hashing).
- **Role and mosque affiliation**: which mosque(s) you're a member of staff
  at, and in what capacity.
- **Operational records**: rota assignments, cover requests, broadcast
  start/stop events, content you create or edit (events, campaigns,
  announcements), and the timestamps and audit trail around those actions.
- **Consent records**: a record of which version of this notice and our
  Terms of Use you agreed to, and when.

### 5.2 Special category data

Your role at a mosque reveals your religious affiliation and practice. We
treat this as special category data under UK GDPR Article 9, and we rely on
your **explicit consent**, captured separately from general account
creation, before processing it. You can withdraw that consent at any time
from Account & Data in Settings, which removes your mosque-staff role and
returns your account to ordinary, everyday use of the app.

### 5.3 Native microphone access (muezzins)

If your mosque uses our in-app live broadcast feature, the app requests
microphone access on your device to capture and transmit the Adhan. This
permission is requested explicitly by the OS, only used while you are
actively broadcasting, and you can revoke it at any time in your device
settings.

### 5.4 Retention

We keep staff account and operational data for as long as your account is
active plus a limited period afterward, to meet legal, accounting, and
dispute-resolution obligations, and to preserve institutional records the
mosque itself needs (for example, a rota history). Exact retention periods
are being finalised and will be published here before this notice goes
live.

### 5.5 Your rights, and account deletion

You can request a copy of your personal data, or ask us to delete your
account, from Account & Data in Settings, or by emailing
privacy@adhanconnect.app. Deletion is handled carefully because removing a
sole administrator, a default muezzin, or a person with open scheduling
commitments can affect a mosque's operations — we will show you an impact
summary before any deletion proceeds, and complete it once you confirm.

## 6. Mosques themselves

A mosque's public profile (name, location, prayer times, services offered,
contact details) is not personal data about an individual — it is
information about the institution, published so anyone using the app can
find and use it. Where a mosque's own contact details include a named
individual (for example, an imam listed in "Key staff"), that mosque is
responsible for ensuring it has a basis to publish that information, and
can request a correction or removal through its own administrators or by
contacting us.

## 7. Who we share information with

We use a small number of infrastructure providers to run Adhan Connect. We
do not sell personal data to anyone, and we do not share it for advertising
purposes.

| Provider | What for | What they may process |
| --- | --- | --- |
| Supabase | Database, authentication (staff accounts only), file storage | Everything described in Sections 4 and 5, hosted in Supabase's infrastructure |
| Expo / EAS | Building and running the app, server API routes | Technical request data; no more than needed to serve the request |
| Apple (APNs) / Google (FCM) | Delivering push notifications | Your device's push token — not your name or email |
| LiveKit Cloud, or a mosque's own broadcast provider | Delivering live Adhan audio | Connection metadata needed to stream audio; audio itself is not stored by us |
| Aladhan API / London Prayer Times | Calculating prayer times where a mosque hasn't published its own schedule | Approximate location or mosque coordinates, not tied to your identity |

Each provider is contractually restricted to processing data only as we
instruct, for the purposes described here.

## 8. International transfers

Some providers above may process data outside the UK or EEA. Where that
happens, we rely on the provider's Standard Contractual Clauses or an
equivalent safeguard recognised under UK GDPR. [Confirm specific transfer
mechanisms per provider before publication.]

## 9. Security

We use industry-standard measures to protect the data described in this
notice — encryption in transit, access controls, and least-privilege
service design (for example, the anonymous session identifiers described
in Section 4.2 are deliberately incapable of being linked back to a name
or email, by design, not just by policy). No system is perfectly secure,
and we cannot guarantee absolute security, but we design Adhan Connect to
minimise what there is to protect in the first place.

## 10. Children

Adhan Connect does not ask anyone's age, name, or identity when used
without a mosque-staff account, so we have no practical way to know
whether someone using it this way is a child — the anonymous session
described in Section 4.2 works the same regardless of age. We have not yet
completed a formal assessment of what that means under child-specific data
protection requirements (for example, the UK's Age Appropriate Design
Code), and we will do so, and update this notice with the outcome, before
this accountless experience is released. Mosque staff accounts require an
administrator or muezzin invitation, are intended for adults carrying out
an operational role, and are gated to age 16 and over.

## 11. Changes to this notice

We will update this notice as the app changes, and post the effective date
at the top. Where a change is material, we will make reasonable efforts to
bring it to the attention of mosque staff accounts (for example, via an
in-app notice), since people using the app without an account cannot be
reached individually by design.

## 12. Contact us

**privacy@adhanconnect.app**

Maksums Limited, trading as Maksums Digital Agency
(operator of the Adhan Connect product)
[Registered address to be added before publication]
