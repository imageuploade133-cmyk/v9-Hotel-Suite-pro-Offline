const fs = require('fs');
const path = require('path');
const cp = require('child_process');

if (fs.existsSync('.next')) {
  fs.rmSync('.next', { recursive: true, force: true });
}

process.env.NEXT_IGNORE_INCORRECT_NODE_VERSION = '1';

// Convert Windows backslashes to forward slashes for NODE_OPTIONS to avoid escape sequence issues
const shimPath = path.resolve(__dirname, 'node-shim.js').replace(/\\/g, '/');
const existingNodeOptions = process.env.NODE_OPTIONS || '';
process.env.NODE_OPTIONS = `-r "${shimPath}" ${existingNodeOptions}`.trim();

const nextBinPath = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const result = cp.spawnSync(process.execPath, ['-r', shimPath, nextBinPath, 'build'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
