const { execFileSync, spawn } = require('child_process');
const { parseProjectEnv } = require('@expo/env');

const PRODUCTION_SUPABASE_REF = 'yecbsezhwvpdkuzmmziv';
const STAGING_SUPABASE_REF = 'zhrucqghrqkjyzmupdyy';

function resolveSupabaseProjectRef(projectRoot) {
  const parsed = parseProjectEnv(projectRoot, {
    mode: process.env.NODE_ENV || 'development',
    silent: true,
  });
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || parsed.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function currentGitBranch(projectRoot) {
  try {
    return execFileSync('git', ['branch', '--show-current'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const projectRoot = process.cwd();
const supabaseProjectRef = resolveSupabaseProjectRef(projectRoot);
const gitBranch = currentGitBranch(projectRoot);
const supabaseTarget = supabaseProjectRef === PRODUCTION_SUPABASE_REF
  ? 'production'
  : supabaseProjectRef === STAGING_SUPABASE_REF
  ? 'staging'
  : 'unknown';

if (
  gitBranch === 'staging' &&
  supabaseProjectRef === PRODUCTION_SUPABASE_REF &&
  process.env.ALLOW_PRODUCTION_SUPABASE_LOCAL !== '1'
) {
  console.error('Refusing to start the staging branch against production Supabase.');
  console.error('Pull the EAS preview environment into .env.local, or set ALLOW_PRODUCTION_SUPABASE_LOCAL=1 for an intentional override.');
  process.exit(1);
}

const passthroughArgs = process.argv.slice(2);
const modeFlag = passthroughArgs.find((arg) => arg === '--server' || arg === '--static');
const useStagingDevClient = passthroughArgs.includes('--staging-dev-client');
const webOutput = modeFlag === '--server' ? 'server' : 'static';
if (useStagingDevClient && supabaseProjectRef !== STAGING_SUPABASE_REF) {
  console.error('Refusing to create a staging development-client QR outside the staging Supabase project.');
  process.exit(1);
}

const forwardedArgs = passthroughArgs.filter(
  (arg) => arg !== '--server' && arg !== '--static' && arg !== '--staging-dev-client'
);
const developmentClientArgs = useStagingDevClient
  ? ['--dev-client', '--lan', '--scheme', 'adhanconnect-staging']
  : [];
const args = ['expo', 'start', '--web', ...developmentClientArgs, ...forwardedArgs];
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  EXPO_WEB_OUTPUT: webOutput,
  EXPO_ENABLE_REACT_COMPILER: 'false',
  ...(useStagingDevClient ? { APP_VARIANT: 'staging' } : {}),
};

console.log(`Starting Expo web in ${webOutput} output mode.`);
console.log(`Supabase target: ${supabaseTarget}${supabaseProjectRef ? ` (${supabaseProjectRef})` : ''}.`);
if (useStagingDevClient) {
  console.log('Native target: Adhan Connect Staging (adhanconnect-staging).');
}
console.log('React Compiler is disabled in this mode to reduce local startup cost.');
if (webOutput === 'static') {
  console.log('Static mode skips Expo Router API routes and server rendering.');
} else {
  console.log('Server mode keeps Expo Router API routes enabled for the web portal.');
}
if (passthroughArgs.includes('--clear')) {
  console.log('Cache clear is enabled. Expect a cold rebuild and noticeably slower first bundle.');
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});
