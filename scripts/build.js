const fs = require('fs');
const cp = require('child_process');

if (fs.existsSync('.next')) {
  fs.rmSync('.next', { recursive: true, force: true });
}

process.env.NEXT_IGNORE_INCORRECT_NODE_VERSION = '1';

const result = cp.spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
