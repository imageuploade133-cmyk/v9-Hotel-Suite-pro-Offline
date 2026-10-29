const fs = require('fs');
const path = require('path');
const cp = require('child_process');

if (fs.existsSync('.next')) {
  fs.rmSync('.next', { recursive: true, force: true });
}

process.env.NEXT_IGNORE_INCORRECT_NODE_VERSION = '1';

const nextBinPath = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');

const result = cp.spawnSync(process.execPath, [nextBinPath, 'build'], {
  stdio: 'inherit',
  env: Object.assign({}, process.env, { NEXT_IGNORE_INCORRECT_NODE_VERSION: '1' }),
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
