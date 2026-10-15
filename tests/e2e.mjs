import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launchServer, root, caseInput } from './helpers.mjs';

const artifactDirectory = join(root, 'tests', 'artifacts');
const browserTemporaryDirectory = join(root, 'tests', '.browser-tmp');
await mkdir(artifactDirectory, { recursive: true });
await mkdir(browserTemporaryDirectory, { recursive: true });
process.env.TMPDIR ||= browserTemporaryDirectory;
let playwright;
try { playwright = createRequire(import.meta.url)('playwright'); }
catch {
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if (!runtime) throw new Error('Install Playwright with npm install --no-save playwright, then npx playwright install chromium.');
  playwright = createRequire(join(runtime, 'package.json'))('playwright');
}
const localChromium = join(browserTemporaryDirectory, 'chromium', 'chromium');
const executablePath = process.env.CHROMIUM_EXECUTABLE || (existsSync(localChromium) ? localChromium : undefined);
const launched = process.env.TEST_BASE_URL ? null : await launchServer();
const baseUrl = (process.env.TEST_BASE_URL || launched.baseUrl).replace(/\/$/, '');
const browser = await playwright.chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--no-zygote', '--disable-gpu', '--disable-dev-shm-usage'] });
const results = [];
const errors = [];
let page;
const step = async (name, work) => {
  const start = Date.now();
  await work();
  results.push({ name, status: 'passed', durationMs: Date.now() - start });
  console.log(`PASS ${name}`);
};
const visible = async locator => { await locator.first().waitFor({ state: 'visible', timeout: 20000 }); };
const route = async path => {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
};
const fetchJson = async path => {
  const response = await page.request.get(`${baseUrl}/api${path}`);
  assert.equal(response.status(), 200, path);
  return response.json();
};

try {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1000 }, acceptDownloads: true });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  await step('Clean browser opens the landing page and enters a demo session', async () => {
    await route('/');
    await visible(page.getByRole('heading', { name: /From reported wallet/i }));
    await page.screenshot({ path: join(artifactDirectory, 'desktop-landing.png'), fullPage: true });
    await page.getByRole('button', { name: /Try live demo/i }).click();
    await page.waitForURL('**/app/dashboard');
    await visible(page.getByRole('heading', { name: 'Intelligence overview' }));
    assert.ok((await fetchJson('/cases')).length >= 5);
    await page.screenshot({ path: join(artifactDirectory, 'desktop-dashboard.png'), fullPage: true });
  });

  await step('Flagship investigation traces 47 transfers and displays consistent candidate intelligence', async () => {
    await page.locator('tr').filter({ hasText: 'CR-2026-00192' }).first().click();
    await page.waitForURL('**/app/investigations/CR-2026-00192');
    await visible(page.getByRole('heading', { name: /CR-2026-00192/ }));
    await page.getByRole('button', { name: 'Start trace', exact: true }).click();
    await visible(page.getByText('Analysis complete · all evidence persisted', { exact: true }));
    assert.equal(await page.locator('[data-graph-item="node"]').count(), 18);
    assert.equal(await page.locator('[data-graph-item="edge"]').count(), 47);
    await visible(page.getByText('ACTIONABLE EXIT', { exact: true }));
    await visible(page.getByRole('heading', { name: 'Fraud flow fingerprint', exact: true }));
    await visible(page.getByRole('heading', { name: 'Cross-chain movement', exact: true }));
    await visible(page.getByText('3 related complaints share this fund-flow network', { exact: true }));
    await page.screenshot({ path: join(artifactDirectory, 'desktop-investigation.png'), fullPage: true });
  });

  await step('Transaction graph supports node, edge, zoom, cluster and path interactions', async () => {
    const node = page.locator('[data-graph-item="node"]').filter({ hasText: 'VASP-X deposit A' }).first();
    await node.focus();
    await node.press('Enter');
    await visible(page.locator('.ws-selection-panel').getByRole('heading', { name: 'VASP-X deposit A' }));
    const before = await page.locator('.graph-controls').textContent();
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    assert.notEqual(await page.locator('.graph-controls').textContent(), before);
    await page.getByRole('button', { name: 'Fit network', exact: true }).click();
    await page.getByRole('button', { name: 'Network', exact: true }).click();
    await page.getByRole('button', { name: 'Collapse clusters', exact: true }).click();
    assert.ok(await page.locator('[data-graph-item="node"]').count() < 18);
    await page.getByRole('button', { name: 'Network', exact: true }).click();
    await page.getByRole('button', { name: 'Show complete network', exact: true }).click();
    assert.equal(await page.locator('[data-graph-item="node"]').count(), 18);
    await page.getByRole('button', { name: 'Fund path', exact: true }).click();
    await visible(page.getByText('Highlighted fund path', { exact: false }));
    await page.getByRole('button', { name: 'Fund path', exact: true }).click();
    const edge = page.locator('[data-graph-item="edge"]').first();
    await edge.focus();
    await edge.press('Enter');
    await visible(page.locator('.ws-selection-panel').getByRole('heading', { name: /Transfer TX-/ }));
    await page.getByRole('tab', { name: /Transactions/ }).click();
    await page.getByRole('textbox', { name: 'Filter transactions' }).fill('TX-047');
    assert.equal(await page.locator('.ws-tx-panel tbody tr').count(), 1);
    await page.getByRole('tab', { name: 'Knowledge graph', exact: true }).click();
    assert.ok(await page.locator('[data-graph-item="node"]').count() > 18);
    await page.getByRole('tab', { name: 'Transaction graph', exact: true }).click();
  });

  await step('Attribution evidence opens linked transactions and records audit metadata', async () => {
    await page.getByRole('button', { name: /Address cluster relationship/ }).click();
    await visible(page.getByRole('dialog', { name: 'Address cluster relationship' }));
    await page.getByRole('dialog').getByRole('button', { name: /TX-041/ }).click();
    await visible(page.locator('.ws-selection-panel').getByRole('heading', { name: 'Transfer TX-041' }));
    assert.ok((await fetchJson('/audit')).some(item => item.action === 'Evidence Viewed'));
  });

  await step('TRACE AI produces case-grounded citations and refuses unsupported evidence', async () => {
    await page.getByRole('button', { name: 'TRACE AI', exact: true }).click();
    await page.getByRole('dialog', { name: 'TRACE AI' }).getByRole('button', { name: 'Which VASP is the strongest candidate?' }).click();
    await visible(page.locator('.ws-ai-citations button'));
    assert.match(await page.locator('.ws-ai-message.assistant').last().textContent(), /VASP-X/);
    await page.getByRole('textbox', { name: 'Ask TRACE AI', exact: true }).fill('What is the wallet owner private key?');
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
    await visible(page.getByText('Insufficient evidence in the current dataset.', { exact: false }));
    await page.locator('.ws-ai-citations button').first().click();
    await visible(page.getByRole('dialog', { name: 'Address cluster relationship' }));
    assert.equal(await page.locator('.ws-assistant-drawer').count(), 0, 'An evidence citation closes the assistant so the evidence modal is usable');
    await page.getByRole('button', { name: 'Close evidence', exact: true }).click();
    await page.getByRole('button', { name: 'TRACE AI', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ask TRACE AI', exact: true }).fill('Which cases are related?');
    await page.getByRole('button', { name: 'Send question', exact: true }).click();
    const relatedCitation = page.locator('.ws-ai-message.assistant').last().locator('.ws-ai-citations button').first();
    await visible(relatedCitation);
    await relatedCitation.click();
    await page.waitForURL(/\/app\/investigations\/CR-2026-0019[346]/);
    await route('/app/investigations/CR-2026-00192');
    await visible(page.getByRole('heading', { name: /CR-2026-00192/ }));
  });

  await step('Investigator exports a real PDF and timeline includes report generation', async () => {
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await page.getByRole('button', { name: 'Export report', exact: true }).click();
    const download = await downloadPromise;
    const path = join(artifactDirectory, 'browser-investigation-report.pdf');
    await download.saveAs(path);
    assert.equal((await readFile(path)).subarray(0, 5).toString(), '%PDF-');
    await visible(page.getByText('Investigation Report Generated', { exact: true }));
  });

  await step('Related complaint navigation follows an actual linked case', async () => {
    await page.locator('.ws-correlation-visual').getByRole('button').first().click();
    await page.waitForURL(/\/app\/investigations\/CR-2026-0019[346]/);
    await visible(page.getByRole('heading', { name: /CR-2026-0019[346]/ }));
  });

  await step('Command palette searches stored evidence and navigates to its case', async () => {
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search and commands' });
    await visible(dialog);
    await dialog.getByRole('textbox').fill('CR-2026-00192');
    await dialog.getByRole('button').filter({ hasText: 'CR-2026-00192' }).first().click();
    await page.waitForURL('**/app/investigations/CR-2026-00192');
    await visible(page.getByRole('heading', { name: /CR-2026-00192/ }));
  });

  await step('Wallet search has useful empty results and opens actual stored wallet intelligence', async () => {
    const record = await fetchJson('/cases/CR-2026-00192');
    await route('/app/wallets');
    await page.getByRole('textbox', { name: 'Wallet, transaction or case' }).fill('not-indexed-in-this-synthetic-dataset');
    await page.getByRole('button', { name: 'Investigate', exact: true }).click();
    await visible(page.getByRole('heading', { name: 'No indexed evidence matches' }));
    await page.getByRole('textbox', { name: 'Wallet, transaction or case' }).fill(record.reportedWallet);
    await page.getByRole('button', { name: 'Investigate', exact: true }).click();
    await visible(page.getByRole('heading', { name: record.reportedWallet, exact: true }));
    await visible(page.getByRole('heading', { name: 'Case-network behavioral context' }));
    assert.ok(await page.locator('.op-wallet-header').count());
  });

  await step('Alert review and dismissal persist through reload', async () => {
    const before = await fetchJson('/alerts');
    const reviewedBefore = before.filter(item => item.status === 'Reviewed').length;
    const dismissedBefore = before.filter(item => item.status === 'Dismissed').length;
    await route('/app/alerts');
    await page.getByRole('button', { name: 'Review', exact: true }).first().click();
    await page.getByRole('button', { name: 'Dismiss alert', exact: true }).first().click();
    await page.getByRole('button', { name: 'Reviewed', exact: true }).click();
    await visible(page.locator('.op-alert'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('heading', { name: 'Intelligence alerts' }));
    const after = await fetchJson('/alerts');
    assert.equal(after.filter(item => item.status === 'Reviewed').length, reviewedBefore + 1);
    assert.equal(after.filter(item => item.status === 'Dismissed').length, dismissedBefore + 1);
  });

  await step('Case creation validates the wallet and persists a newly traced investigation', async () => {
    const input = caseInput({ id: `CR-E2E-${Date.now()}` });
    await route('/app/new');
    await page.getByRole('button', { name: 'Fill a fictional example' }).click();
    await page.getByLabel(/^Case ID/).fill(input.id);
    await page.getByLabel(/^Complaint ID/).fill(input.complaintId);
    await page.getByLabel('Reported victim loss', { exact: true }).fill(String(input.victimLoss));
    await page.getByLabel('Reported wallet', { exact: true }).fill('invalid-wallet');
    await page.getByRole('button', { name: 'Start trace', exact: true }).click();
    await visible(page.getByRole('alert').getByText('Enter a valid Ethereum wallet address.'));
    await page.getByLabel('Reported wallet', { exact: true }).fill(input.reportedWallet);
    await page.getByLabel(/^Investigation description/).fill('Synthetic browser test. <img src=x onerror=alert(1)> remains plain text.');
    await page.getByRole('button', { name: 'Start trace', exact: true }).click();
    await page.waitForURL(`**/app/investigations/${input.id}`);
    await visible(page.getByRole('heading', { name: new RegExp(input.id) }));
    assert.equal(await page.locator('[data-graph-item="node"]').count(), 18);
    const record = await fetchJson(`/cases/${input.id}`);
    assert.equal(record.reportedWallet, input.reportedWallet.toLowerCase());
    assert.equal(record.victimLoss, input.victimLoss);
    await page.getByRole('combobox', { name: 'Case status', exact: true }).selectOption('Monitoring');
    await visible(page.getByText('Case marked monitoring.', { exact: true }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await visible(page.getByRole('heading', { name: new RegExp(input.id) }));
    assert.equal(await page.getByRole('combobox', { name: 'Case status' }).inputValue(), 'Monitoring');
  });

  await step('Information request preparation keeps the selected case and downloads an unsent package', async () => {
    await route('/app/investigations/CR-2026-00193');
    await page.getByRole('button', { name: /Prepare information request/ }).click();
    await page.waitForURL('**/app/requests?caseId=CR-2026-00193');
    await visible(page.getByRole('button', { name: 'Generate information request package', exact: true }));
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Generate information request package', exact: true }).click();
    const download = await downloadPromise;
    const path = join(artifactDirectory, 'browser-information-request.json');
    await download.saveAs(path);
    const contents = await readFile(path, 'utf8');
    JSON.parse(contents);
    assert.match(contents, /CR-2026-00193/);
    assert.match(contents, /review|not sent|not submitted/i);
    await visible(page.getByRole('heading', { name: 'Prepared package preview' }));
  });

  await step('Every intelligence and operations page renders without an application error', async () => {
    for (const path of ['cases', 'wallets', 'vasps', 'cross-chain', 'patterns', 'alerts', 'reports', 'requests', 'sources', 'api', 'settings', 'new']) {
      await route(`/app/${path}`);
      await visible(page.locator('main.app-main h1'));
      await page.waitForFunction(() => !document.querySelector('.op-skeleton, .loading-state'), undefined, { timeout: 20000 });
      const content = await page.locator('main.app-main').textContent();
      assert.doesNotMatch(content, /This page does not exist|Something went wrong|Investigation unavailable|Unable to load data|Request could not be completed/);
      if (['new', 'vasps', 'settings', 'requests'].includes(path)) {
        await page.screenshot({ path: join(artifactDirectory, `desktop-${path}.png`), fullPage: true });
      }
    }
  });

  await step('Mobile landing, dashboard and investigation remain readable without document overflow', async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    await mobilePage.getByRole('button', { name: /Explore demo case/i }).click();
    await mobilePage.waitForURL('**/app/investigations/CR-2026-00192');
    await visible(mobilePage.getByRole('heading', { name: /CR-2026-00192/ }));
    const dimensions = await mobilePage.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(dimensions.scroll <= dimensions.width + 2, `Mobile document width ${dimensions.scroll} exceeds viewport ${dimensions.width}`);
    await mobilePage.screenshot({ path: join(artifactDirectory, 'mobile-investigation.png'), fullPage: true });
    await mobilePage.getByRole('button', { name: 'Open menu', exact: true }).click();
    await mobilePage.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await visible(mobilePage.getByRole('heading', { name: 'Intelligence overview' }));
    await mobilePage.screenshot({ path: join(artifactDirectory, 'mobile-dashboard.png'), fullPage: true });
    await mobile.close();
  });

  assert.deepEqual(errors, [], 'No browser JavaScript exceptions');
  await context.close();
  await writeFile(join(artifactDirectory, 'browser-results.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results, errors }, null, 2));
  console.log(`Browser verification passed: ${results.length} workflows at ${baseUrl}`);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: join(artifactDirectory, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(join(artifactDirectory, 'browser-results.json'), JSON.stringify({ baseUrl, generatedAt: new Date().toISOString(), results, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
  await launched?.close();
}
