/**
 * True only when the app is running on a persistent Node.js Local Master Server.
 * Vercel and other serverless runtimes must use cloud-backed application paths,
 * never the filesystem-backed LAN queue.
 */
export function isLocalMasterServerRuntime(): boolean {
  return process.env.VERCEL !== '1'
    && !process.env.AWS_LAMBDA_FUNCTION_NAME
    && !process.env.NOW_REGION;
}
