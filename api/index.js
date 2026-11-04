import { handle } from '../server/index.mjs';

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
