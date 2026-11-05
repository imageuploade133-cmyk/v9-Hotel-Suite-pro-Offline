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

// If standalone output was generated, copy static assets and public folder so it can run autonomously
const standaloneDir = path.resolve(process.cwd(), '.next', 'standalone');
if (fs.existsSync(standaloneDir)) {
  const publicDir = path.resolve(process.cwd(), 'public');
  const staticDir = path.resolve(process.cwd(), '.next', 'static');
  const targetPublic = path.resolve(standaloneDir, 'public');
  const targetStatic = path.resolve(standaloneDir, '.next', 'static');

  try {
    if (fs.existsSync(publicDir) && !fs.existsSync(targetPublic)) {
      fs.cpSync(publicDir, targetPublic, { recursive: true });
    }
    if (fs.existsSync(staticDir) && !fs.existsSync(targetStatic)) {
      fs.mkdirSync(path.dirname(targetStatic), { recursive: true });
      fs.cpSync(staticDir, targetStatic, { recursive: true });
    }
  } catch (err) {
    console.warn('[BUILD] Note: Could not copy static assets to standalone folder:', err.message);
  }
}

