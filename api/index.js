import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../server/index.mjs';

// Anchor dataset files for Vercel Node File Trace (nft)
const _dir = dirname(fileURLToPath(import.meta.url));
try {
  if (process.env.__VERCEL_NFT_ANCHOR) {
    readFileSync(resolve(_dir, '../data/elliptic/elliptic_txs_classes.csv'));
    readFileSync(resolve(_dir, '../data/elliptic/elliptic_txs_edgelist.csv'));
    readFileSync(resolve(_dir, '../data/elliptic/model_scores.json'));
    readFileSync(resolve(_dir, '../data/elliptic/model_evaluation.json'));
    readFileSync(resolve(_dir, '../data/elliptic/features_offsets.json'));
  }
} catch {}

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
