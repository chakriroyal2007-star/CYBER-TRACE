import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

export async function launchServer() {
  const directory = await mkdtemp(join(root, 'tests', '.tmp-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    HOST: '127.0.0.1',
    DB_PATH: join(directory, 'test.sqlite'),
    DATABASE_PATH: join(directory, 'test.sqlite'),
    JWT_SECRET: 'isolated-test-secret-never-use-for-deployment',
    SESSION_SECRET: 'isolated-test-session-secret-never-use-for-deployment',
    ALLOWED_ORIGINS: baseUrl,
    CORS_ORIGIN: baseUrl,
  };
  let child;
  let output = '';
  async function start() {
    child = spawn(process.execPath, ['server/index.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null) throw new Error(`Test server exited (${child.exitCode}):\n${output}`);
      try {
        const response = await fetch(`${baseUrl}/api/health`);
        if (response.ok) return;
      } catch { /* Server is starting. */ }
      await pause(100);
    }
    throw new Error(`Test server failed to become healthy:\n${output}`);
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    await new Promise(resolve => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); }, 2500);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.kill('SIGTERM');
    });
  }
  await start();
  return {
    baseUrl, directory,
    get output() { return output; },
    restart: async () => { await stop(); await start(); },
    close: async () => { await stop(); await rm(directory, { recursive: true, force: true }); },
  };
}

export function client(baseUrl) {
  let cookie = '';
  const request = async (path, { method = 'GET', body, headers = {}, ...options } = {}) => {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...options,
    });
    const received = response.headers.getSetCookie?.() || [];
    if (received.length) cookie = received.map(value => value.split(';')[0]).join('; ');
    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await response.json() : await response.arrayBuffer();
    return { response, data };
  };
  return { request, get cookie() { return cookie; }, login: () => request('/auth/demo', { method: 'POST', body: {} }) };
}

export const caseInput = (overrides = {}) => ({
  id: `CR-TEST-${Date.now().toString().slice(-9)}`,
  complaintId: 'SYNTHETIC-TEST-COMPLAINT',
  fraudType: 'Investment Scam',
  victimLoss: 125000,
  currency: 'INR',
  reportedWallet: `0xaA${'0'.repeat(34)}aA01`,
  chain: 'Ethereum',
  priority: 'High',
  description: 'Synthetic integration-test complaint. No actual persons or financial records.',
  attachments: [],
  ...overrides,
});
