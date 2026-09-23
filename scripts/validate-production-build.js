#!/usr/bin/env node
'use strict';

const { execFileSync } = require('node:child_process');

const SUPABASE_ORIGIN = 'https://zhrucqghrqkjyzmupdyy.supabase.co';
const API_ORIGIN = 'https://adhan-connect.expo.app';
const PACKAGE = 'com.maksumsdigitalagency.adhanconnect';

function requireRootUrl(value, origin, label) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${label} is missing or invalid.`); }
  if (url.origin !== origin || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    // Do not echo a misconfigured URL: it could contain credentials.
    throw new Error(`${label} must be ${origin} with no credentials, path, query or fragment.`);
  }
}

function validateEnvironment(env) {
  if (env.APP_VARIANT?.trim().toLowerCase() !== 'production') {
    throw new Error('This production workflow requires explicit APP_VARIANT=production.');
  }
  requireRootUrl(env.EXPO_PUBLIC_SUPABASE_URL, SUPABASE_ORIGIN, 'Supabase URL');
  requireRootUrl(env.EXPO_PUBLIC_API_BASE_URL, API_ORIGIN, 'API URL');
  if (!env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    throw new Error('Production Supabase client key is missing.');
  }
}

function validateIdentity(config) {
  const expected = [
    [config.name, 'Adhan Connect', 'display name'],
    [config.ios?.bundleIdentifier, PACKAGE, 'iOS bundle identifier'],
    [config.android?.package, PACKAGE, 'Android package'],
    [config.scheme, 'adhanconnect', 'URL scheme'],
    [config.extra?.appVariant, 'production', 'app variant'],
  ];
  for (const [actual, value, label] of expected) {
    if (actual !== value) throw new Error(`Unexpected production ${label}.`);
  }
}

if (require.main === module) {
  try {
    validateEnvironment(process.env);
    if (!process.argv.includes('--environment-only')) {
      const config = JSON.parse(execFileSync('npx', ['expo', 'config', '--json'], {
        encoding: 'utf8',
        env: { ...process.env, EXPO_NO_DOTENV: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }));
      validateIdentity(config);
    }
    console.log('Production build validation passed.');
  } catch (error) {
    console.error(error.status !== undefined ? 'Expo configuration could not be resolved.' : error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateEnvironment, validateIdentity };
