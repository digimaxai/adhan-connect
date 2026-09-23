'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateEnvironment, validateIdentity } = require('./validate-production-build');

const env = {
  APP_VARIANT: 'production',
  EXPO_PUBLIC_SUPABASE_URL: 'https://zhrucqghrqkjyzmupdyy.supabase.co',
  EXPO_PUBLIC_API_BASE_URL: 'https://adhan-connect.expo.app',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'non-secret-test-client-key',
};
const config = {
  name: 'Adhan Connect',
  ios: { bundleIdentifier: 'com.maksumsdigitalagency.adhanconnect' },
  android: { package: 'com.maksumsdigitalagency.adhanconnect' },
  scheme: 'adhanconnect',
  extra: { appVariant: 'production' },
};

test('accepts retained production target and explicit production identity', () => {
  assert.doesNotThrow(() => validateEnvironment(env));
  assert.doesNotThrow(() => validateIdentity(config));
  assert.doesNotThrow(() => validateEnvironment({ ...env, EXPO_PUBLIC_API_BASE_URL: `${env.EXPO_PUBLIC_API_BASE_URL}/` }));
});

for (const variant of [undefined, '', 'staging', 'prod']) {
  test(`rejects incorrect or missing variant ${String(variant)}`, () => {
    assert.throws(() => validateEnvironment({ ...env, APP_VARIANT: variant }), /APP_VARIANT/);
  });
}

for (const [name, key, value] of [
  ['old database', 'EXPO_PUBLIC_SUPABASE_URL', 'https://yecbsezhwvpdkuzmmziv.supabase.co'],
  ['HTTP database', 'EXPO_PUBLIC_SUPABASE_URL', 'http://zhrucqghrqkjyzmupdyy.supabase.co'],
  ['wrong database port', 'EXPO_PUBLIC_SUPABASE_URL', 'https://zhrucqghrqkjyzmupdyy.supabase.co:444'],
  ['missing database', 'EXPO_PUBLIC_SUPABASE_URL', undefined],
  ['database path', 'EXPO_PUBLIC_SUPABASE_URL', `${env.EXPO_PUBLIC_SUPABASE_URL}/wrong`],
  ['preview API', 'EXPO_PUBLIC_API_BASE_URL', 'https://adhan-connect--preview.expo.app'],
  ['HTTP API', 'EXPO_PUBLIC_API_BASE_URL', 'http://adhan-connect.expo.app'],
  ['API path', 'EXPO_PUBLIC_API_BASE_URL', `${env.EXPO_PUBLIC_API_BASE_URL}/wrong`],
  ['API query', 'EXPO_PUBLIC_API_BASE_URL', `${env.EXPO_PUBLIC_API_BASE_URL}?secret=test`],
  ['API fragment', 'EXPO_PUBLIC_API_BASE_URL', `${env.EXPO_PUBLIC_API_BASE_URL}#wrong`],
  ['API credentials', 'EXPO_PUBLIC_API_BASE_URL', 'https://name:private-value@adhan-connect.expo.app'],
  ['missing client key', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', ''],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => validateEnvironment({ ...env, [key]: value }));
  });
}

test('rejects completely missing environment', () => {
  assert.throws(() => validateEnvironment({}));
});

for (const [name, override] of [
  ['iOS override', { ios: { bundleIdentifier: 'com.example.wrong' } }],
  ['Android override', { android: { package: 'com.example.wrong' } }],
  ['staging scheme', { scheme: 'adhanconnect-staging' }],
  ['staging variant', { extra: { appVariant: 'staging' } }],
  ['staging name', { name: 'Adhan Connect Staging' }],
]) {
  test(`rejects resolved ${name}`, () => {
    assert.throws(() => validateIdentity({ ...config, ...override }));
  });
}

test('URL errors do not echo supplied credentials', () => {
  assert.throws(
    () => validateEnvironment({ ...env, EXPO_PUBLIC_API_BASE_URL: 'https://name:private-value@adhan-connect.expo.app' }),
    (error) => !error.message.includes('private-value'),
  );
});
