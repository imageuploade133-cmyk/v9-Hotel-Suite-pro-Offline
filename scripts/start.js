const path = require('path');
const cp = require('child_process');

process.env.NEXT_IGNORE_INCORRECT_NODE_VERSION = '1';
process.env.NODE_ENV = 'production';

const shimPath = path.join(__dirname, 'node-shim.js');
const nextBinPath = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const host = process.env.HOST || '0.0.0.0';
const port = process.env.PORT || '3000';

const result = cp.spawnSync(process.execPath, ['-r', shimPath, nextBinPath, 'start', '-H', host, '-p', port], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
