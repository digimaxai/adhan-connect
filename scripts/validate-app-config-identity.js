#!/usr/bin/env node
// Guards against the exact hazard flagged in the production-promotion handover:
// app.config.js infers `isStaging` from the Supabase project ref when
// APP_VARIANT is not explicitly set, and the retained production project
// (zhrucqghrqkjyzmupdyy) is the SAME ref previously used to identify staging.
// This script proves the explicit-variant override still resolves correctly
// for both identities. Production workflows separately validate real inputs.
'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const RETAINED_SUPABASE_URL = 'https://zhrucqghrqkjyzmupdyy.supabase.co';
const PRODUCTION_API_BASE_URL = 'https://adhan-connect.expo.app';

function resolveConfig(env) {
  const output = execFileSync('npx', ['expo', 'config', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, EXPO_NO_DOTENV: '1', IOS_BUNDLE_IDENTIFIER: '', ANDROID_PACKAGE_NAME: '', ...env },
  });
  return JSON.parse(output);
}

function run(name, env, checks) {
  const config = resolveConfig(env);
  for (const [label, actual, expected] of checks(config)) {
    assert.equal(actual, expected, `${name}: expected ${label} to be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`OK  ${name}`);
}

run(
  'explicit production + retained URL resolves to production identity',
  { APP_VARIANT: 'production', EXPO_PUBLIC_SUPABASE_URL: RETAINED_SUPABASE_URL, EXPO_PUBLIC_API_BASE_URL: PRODUCTION_API_BASE_URL },
  (config) => [
    ['ios.bundleIdentifier', config.ios?.bundleIdentifier, 'com.maksumsdigitalagency.adhanconnect'],
    ['android.package', config.android?.package, 'com.maksumsdigitalagency.adhanconnect'],
    ['scheme', config.scheme, 'adhanconnect'],
    ['extra.appVariant', config.extra?.appVariant, 'production'],
  ],
);

run(
  'explicit staging + retained URL resolves to staging identity',
  { APP_VARIANT: 'staging', EXPO_PUBLIC_SUPABASE_URL: RETAINED_SUPABASE_URL },
  (config) => [
    ['ios.bundleIdentifier', config.ios?.bundleIdentifier, 'com.maksumsdigitalagency.adhanconnect.staging'],
    ['android.package', config.android?.package, 'com.maksumsdigitalagency.adhanconnect.staging'],
    ['scheme', config.scheme, 'adhanconnect-staging'],
    ['extra.appVariant', config.extra?.appVariant, 'staging'],
  ],
);

console.log('\nBoth explicit identities resolve correctly.');
console.log('NOTE: app.config.js does not cross-check APP_VARIANT against the Supabase');
console.log('project ref itself (by design, per the production-promotion handover) — an');
console.log('omitted or wrong APP_VARIANT on a build targeting the retained project silently');
console.log('falls back to staging. That specific case is guarded at the CI layer instead:');
console.log('.github/workflows/android-production-build.yml and ios/ci_scripts/ci_post_clone.sh.');
