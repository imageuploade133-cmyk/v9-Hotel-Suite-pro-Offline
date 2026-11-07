/**
 * Backward-compatible entry point for installations that previously
 * registered /service-worker.js. Keep its behavior aligned with /sw.js
 * so an old registration cannot continue serving stale Next.js payloads.
 */
importScripts('/sw.js');
