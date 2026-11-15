import app from "../src/app.js";

/**
 * Vercel serverless entry point.
 * vercel.json rewrites every request to this function, so Express keeps
 * receiving the original URL (e.g. /api/studios/123).
 */
export default app;
