const { spawn } = require('child_process');

const passthroughArgs = process.argv.slice(2);
const modeFlag = passthroughArgs.find((arg) => arg === '--server' || arg === '--static');
const webOutput = modeFlag === '--server' ? 'server' : 'static';
const args = ['expo', 'start', '--web', ...passthroughArgs.filter((arg) => arg !== '--server' && arg !== '--static')];
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const env = {
  ...process.env,
  EXPO_WEB_OUTPUT: webOutput,
  EXPO_ENABLE_REACT_COMPILER: 'false',
};

console.log(`Starting Expo web in ${webOutput} output mode.`);
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
