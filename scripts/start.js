const path = require('path');
const cp = require('child_process');
const fs = require('fs');

process.env.NEXT_IGNORE_INCORRECT_NODE_VERSION = '1';
process.env.NODE_ENV = 'production';

const host = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';
const port = process.env.PORT || '3000';
process.env.HOST = host;
process.env.HOSTNAME = host;
process.env.PORT = port;

const shimPath = path.resolve(__dirname, 'node-shim.js').replace(/\\/g, '/');
const standaloneServerPath = path.resolve(process.cwd(), '.next', 'standalone', 'server.js');

// If standalone build output exists, launch the standalone server directly
if (fs.existsSync(standaloneServerPath)) {
  const result = cp.spawnSync(process.execPath, ['-r', shimPath, standaloneServerPath], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
} else {
  // Standard Next.js production server
  const nextBinPath = path.resolve(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const result = cp.spawnSync(process.execPath, ['-r', shimPath, nextBinPath, 'start', '-H', host, '-p', port], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

