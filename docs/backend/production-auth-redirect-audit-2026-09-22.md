# Production Auth redirect audit

Status at 22 September 2026: read-only audit complete; production unchanged.

## Verified identities

- Supabase production project: `yecbsezhwvpdkuzmmziv` (`adhan_connect`),
  `ACTIVE_HEALTHY`, region `eu-west-1`.
- Supabase staging project: `zhrucqghrqkjyzmupdyy`
  (`adhan-connect-staging`), `ACTIVE_HEALTHY`, region `eu-west-1`.
- EAS production web alias: `https://adhan-connect.expo.app`, currently on
  deployment `b5blckazxb`.
- EAS preview alias: `https://adhan-connect--preview.expo.app`, currently on
  deployment `ct1o9bkpvl`.
- Production native scheme: `adhanconnect`.
- Staging native scheme: `adhanconnect-staging`.

A read-only HTTP smoke check returned `200` from the production alias root,
`/callback`, and `/new-password`. The proposed HTTPS routes therefore exist on
the current production deployment as well as in the promotion source.

## Current production state

The Supabase Management API returned this non-secret Auth routing state:

```text
site URL: http://localhost:8081
redirect allowlist:
  exp://192.168.1.189:8081/--/callback
  adhanconnect://callback
  http://localhost:19006/callback
  http://localhost:19006
  http://localhost:8081/admin
  http://localhost:19006/admin
  http://localhost:8081/callback
  http://localhost:8081/new-password
```

This is not release-ready. The site URL points to a developer machine, the
native password-reset route is absent, the production web routes are absent,
and production retains obsolete local-network/development destinations.

Production sign-up remains enabled, email Auth remains enabled, email
autoconfirm remains disabled, and CAPTCHA remains disabled. This audit does not
change those policies.

## Proposed release state

Use the canonical production HTTPS origin as the site URL and use only exact
routes needed by the production web and native clients:

```text
site URL: https://adhan-connect.expo.app
redirect allowlist:
  https://adhan-connect.expo.app/callback
  https://adhan-connect.expo.app/new-password
  adhanconnect://callback
  adhanconnect://new-password
```

Do not add the preview origin, `adhanconnect-staging`, localhost, Expo Go, or a
wildcard to the production allowlist. Staging retains its own callbacks.

No client redirect override is required for the first native production beta:
the app derives `adhanconnect://callback` and
`adhanconnect://new-password` from the committed production scheme. Web uses
its runtime origin, which resolves to the two exact HTTPS routes above.

## Controlled application and rollback

Apply the Auth change only after the release commit and production web origin
are reconfirmed and immediately before the production Auth acceptance tests.
Record a fresh safe-field GET response before the PATCH. The PATCH must change
only `site_url` and `uri_allow_list`; it must not send or replace SMTP,
provider, JWT, CAPTCHA, signup, or email-confirmation settings.

Fail closed if the current values differ from the state recorded above. After
the PATCH, GET the safe fields again and compare exact normalized routes.

If the new routing causes an acceptance failure, restore the previous site URL
and allowlist shown in **Current production state**, then repeat the safe-field
GET. The existing `adhanconnect://callback` route is present in both states, so
the rollback retains the current native email-confirmation destination.

## Acceptance checks

Run each test against the production beta with a disposable account:

1. Web sign-up requests
   `https://adhan-connect.expo.app/callback`; confirmation returns to the
   production web app and creates one session.
2. Web password recovery requests the exact `/new-password` route; an expired
   or reused link fails closed.
3. iOS and Android sign-up request `adhanconnect://callback`; cold and warm app
   opens complete once and retain the same Auth UUID.
4. iOS and Android recovery request `adhanconnect://new-password`; the password
   form requires valid one-use recovery evidence.
5. A preview/staging URL, localhost URL, arbitrary production path, and
   `adhanconnect-staging` URL are rejected as redirect destinations.
6. Main-admin, local-admin, muezzin, and listener routing still resolves after
   a fresh sign-in.

Keep Apple, Google and social-linking client flags disabled until their
separate provider and account-linking release gates pass.
