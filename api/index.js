import { handle } from '../server/index.mjs';

// Vercel serverless runtime serves public demonstration and judge evaluation sandbox
process.env.ALLOW_PRODUCTION_DEMO = process.env.ALLOW_PRODUCTION_DEMO || 'true';
process.env.DEMO_MODE = process.env.DEMO_MODE || 'true';

export default async function handler(req, res) {
  try {
    await handle(req, res);
  } catch (error) {
    if (!res.headersSent) {
      const status = error.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message || 'An internal error occurred.' }));
    }
  }
}
