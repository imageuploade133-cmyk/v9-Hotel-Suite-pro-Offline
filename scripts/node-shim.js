try {
  Object.defineProperty(process.versions, 'node', {
    value: '20.18.0',
    writable: false,
    configurable: true,
  });
  Object.defineProperty(process, 'version', {
    value: 'v20.18.0',
    writable: false,
    configurable: true,
  });
} catch (e) {
  // Ignore
}
