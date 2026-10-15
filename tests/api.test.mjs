import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { launchServer, client, caseInput } from './helpers.mjs';

describe('CRYPTO-TRACE INDIA: persistent, evidence-grounded demo API', { concurrency: false }, () => {
  let server, investigator, otherInvestigator, seed, created, addedWallet;

  before(async () => {
    server = await launchServer();
    investigator = client(server.baseUrl);
    otherInvestigator = client(server.baseUrl);
    assert.equal((await investigator.login()).response.status, 200);
    assert.equal((await otherInvestigator.login()).response.status, 200);
    assert.ok(investigator.cookie, 'Demo access establishes a server session');
    assert.notEqual(investigator.cookie, otherInvestigator.cookie, 'Demo visitors receive separate sessions');
  });
  after(async () => { await server?.close(); });

  it('serves health, API documentation, source disclosure and secure headers', async () => {
    assert.equal((await client(server.baseUrl).request('/cases')).response.status, 401);
    const health = await investigator.request('/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.response.headers.get('x-content-type-options'), 'nosniff');
    const schema = await investigator.request('/openapi.json');
    assert.equal(schema.response.status, 200);
    assert.match(schema.data.openapi, /^3\./);
    for (const endpoint of ['/api/cases', '/api/health', '/api/graph/{id}']) {
      assert.ok(schema.data.paths[endpoint] || schema.data.paths[endpoint.replace('/api', '')], `Documented ${endpoint}`);
    }
    assert.equal((await investigator.request('/docs')).response.status, 200);
    const sources = (await investigator.request('/sources')).data;
    assert.ok(Array.isArray(sources) && sources.length >= 5);
    assert.ok(sources.some(source => /demo|simulat/i.test(`${source.mode} ${source.name}`)));
    for (const source of sources.filter(item => /NCRP|SAHYOG/i.test(item.name))) {
      assert.doesNotMatch(source.status, /^connected$/i, 'Unconfigured government integration must not claim connectivity');
    }
  });

  it('keeps the flagship case internally consistent: 18 wallets, 47 transactions and INR 642,000 exit', async () => {
    const result = await investigator.request('/investigations/CR-2026-00192');
    assert.equal(result.response.status, 200);
    seed = result.data;
    assert.equal(seed.case.victimLoss, 812450);
    assert.equal(seed.case.tracedAmount, 642000);
    assert.equal(seed.case.transactionCount, 47);
    assert.equal(seed.case.walletCount, 18);
    assert.equal(seed.nodes.length, 18);
    assert.equal(seed.edges.length, 47);
    assert.equal(seed.case.confidence, 91);
    assert.equal(new Set(seed.nodes.map(node => node.id)).size, 18);
    assert.equal(new Set(seed.edges.map(edge => edge.id)).size, 47);
    const nodes = new Set(seed.nodes.map(node => node.id));
    for (const edge of seed.edges) {
      assert.ok(nodes.has(edge.source) && nodes.has(edge.target), `No dangling graph edge ${edge.id}`);
      assert.ok(edge.amount > 0 && Number.isFinite(edge.amount));
      assert.ok(Number.isFinite(Date.parse(edge.timestamp)));
      assert.ok(edge.hash, 'Every transaction has a reference hash');
    }
    assert.equal(new Set(seed.nodes.map(node => node.chain)).size, 2);
    const exit = seed.attributions.find(item => item.candidate === 'VASP-X');
    assert.equal(exit.confidence, 91);
    assert.equal(exit.tracedAmount, 642000);
    assert.equal(exit.transactionCount, 7);
    const exitIds = new Set(seed.nodes.filter(node => node.type === 'vasp' && node.entity === 'VASP-X').map(node => node.id));
    assert.ok(exitIds.size > 0);
    const deposits = seed.edges.filter(edge => exitIds.has(edge.target));
    assert.equal(deposits.length, 7);
    assert.equal(deposits.reduce((sum, item) => sum + item.amount, 0), 642000);
  });

  it('provides graph, cross-chain evidence, scored fingerprint and related-complaint links', async () => {
    const graph = (await investigator.request('/graph/CR-2026-00192')).data;
    assert.equal(graph.nodes.length, seed.nodes.length);
    assert.equal(graph.edges.length, seed.edges.length);
    assert.ok(seed.crossChain.length >= 1);
    assert.ok(seed.crossChain.some(item => item.sourceChain === 'Ethereum' && item.destinationChain === 'Polygon'));
    assert.ok(Object.keys(seed.fingerprint.features).length >= 12, 'Fingerprint calculated from a full feature vector');
    assert.equal(seed.fingerprint.patterns.reduce((sum, pattern) => sum + pattern.score, 0), 100);
    assert.ok(seed.fingerprint.patterns.every(pattern => pattern.reason && pattern.evidenceIds.length));
    const related = (await investigator.request('/cases/CR-2026-00192/related')).data;
    assert.equal(related.length, 3);
    assert.equal(new Set(related.map(item => item.caseId)).size, 3);
    for (const relation of related) {
      assert.ok(relation.sharedWallet || relation.sharedCluster);
      assert.ok(relation.confidence > 0 && relation.confidence <= 100);
      assert.equal((await investigator.request(`/cases/${relation.caseId}`)).response.status, 200);
    }
    assert.ok(seed.knowledgeGraph.nodes.length && seed.knowledgeGraph.edges.length);
  });

  it('creates a normalized wallet and case, performs persisted analysis, and isolates visitors', async () => {
    const input = caseInput();
    const result = await investigator.request('/cases', { method: 'POST', body: input });
    assert.equal(result.response.status, 201);
    created = result.data;
    assert.equal(created.reportedWallet, input.reportedWallet.toLowerCase());
    assert.equal(created.victimLoss, input.victimLoss);
    const run = await investigator.request('/investigations', { method: 'POST', body: { caseId: created.id } });
    assert.equal(run.response.status, 200);
    assert.ok(run.data.nodes.length > 1 && run.data.edges.length > 0);
    assert.ok(run.data.case.riskScore >= 0 && run.data.case.riskScore <= 100);
    assert.equal(run.data.case.transactionCount, run.data.edges.length);
    assert.equal(run.data.case.walletCount, run.data.nodes.length);
    assert.equal((await otherInvestigator.request(`/cases/${created.id}`)).response.status, 404);
    const foreignCases = (await otherInvestigator.request('/cases')).data;
    assert.ok(!foreignCases.some(item => item.id === created.id));
    const wallet = await investigator.request(`/wallets/${created.reportedWallet}`);
    assert.equal(wallet.response.status, 200);
    assert.ok(wallet.data.cases.some(item => item.id === created.id));
    const transactions = await investigator.request(`/wallets/${created.reportedWallet}/transactions`);
    assert.ok(transactions.response.ok && Array.isArray(transactions.data));
    const filtered = (await investigator.request(`/cases?q=${encodeURIComponent(created.id)}`)).data;
    assert.ok(filtered.some(item => item.id === created.id));
    const search = (await investigator.request(`/search?q=${encodeURIComponent(created.reportedWallet)}`)).data;
    assert.ok(search.some(item => item.type.toLowerCase() === 'wallet'));
  });

  it('rejects invalid input and does not expose internal SQL or file-system errors', async () => {
    for (const overrides of [
      { reportedWallet: 'not-a-blockchain-address' },
      { victimLoss: -100 },
      { chain: 'UnsupportedChain' },
      { victimLoss: 'not-a-number' },
    ]) {
      const result = await investigator.request('/cases', { method: 'POST', body: caseInput(overrides) });
      assert.equal(result.response.status, 400);
      assert.equal(typeof result.data.error, 'string');
      assert.doesNotMatch(result.data.error, /SELECT |INSERT |SQLITE_|\/workspace\/|stack:/i);
    }
    assert.equal((await investigator.request('/cases', { method: 'POST', body: caseInput({ id: created.id }) })).response.status, 409);
    assert.equal((await investigator.request('/cases/no-such-case')).response.status, 404);
    assert.equal((await investigator.request(`/cases/${created.id}`, { method: 'PATCH', body: { status: 'Made Up Status' } })).response.status, 400);
  });

  it('adds and normalizes an analyst wallet without creating duplicate graph nodes', async () => {
    const input = { caseId: created.id, address: `0x${'B2'.repeat(20)}`, chain: 'Ethereum', label: 'Synthetic analyst-added wallet' };
    const result = await investigator.request('/wallets', { method: 'POST', body: input });
    assert.equal(result.response.status, 201);
    addedWallet = result.data;
    assert.equal(addedWallet.address, input.address.toLowerCase());
    const graph = (await investigator.request(`/graph/${created.id}`)).data;
    assert.ok(graph.nodes.some(node => node.id === addedWallet.id));
    assert.equal((await investigator.request('/wallets', { method: 'POST', body: input })).response.status, 409);
    assert.equal((await otherInvestigator.request('/wallets', { method: 'POST', body: input })).response.status, 404);
  });

  it('ingests valid transactions idempotently, updates wallet metrics and preserves evidence when retraced', async () => {
    const original = (await investigator.request(`/investigations/${created.id}`)).data;
    const sample = original.edges[0];
    const source = original.nodes.find(node => node.chain === addedWallet.chain && node.balance > 1000);
    assert.ok(source, 'A funded wallet is available for the synthetic transfer');
    const transaction = {
      ...sample,
      source: source.id,
      target: addedWallet.id,
      chain: source.chain,
      id: `${created.id}-TX-TEST-INGEST`,
      hash: `0x${'abc123'.repeat(10)}abcd`,
      amount: 250,
      timestamp: '2026-09-24T16:00:00.000Z',
    };
    const input = { caseId: created.id, transactions: [transaction] };
    const ingest = await investigator.request('/transactions/ingest', { method: 'POST', body: input });
    assert.ok(ingest.response.ok, `Transaction ingestion succeeds: ${JSON.stringify(ingest.data)}`);
    const updated = (await investigator.request(`/graph/${created.id}`)).data;
    assert.equal(updated.edges.length, original.edges.length + 1);
    assert.ok(updated.edges.some(edge => edge.id === transaction.id && edge.amount === transaction.amount));
    assert.equal(updated.nodes.find(node => node.id === addedWallet.id).incomingCount, 1);
    assert.equal(updated.nodes.find(node => node.id === addedWallet.id).balance, 250);
    assert.equal(updated.nodes.find(node => node.id === source.id).outgoingCount, source.outgoingCount + 1);
    const replay = await investigator.request('/transactions/ingest', { method: 'POST', body: input });
    assert.ok(replay.response.ok || replay.response.status === 409, 'Duplicate ingestion is explicitly handled');
    assert.equal((await investigator.request(`/graph/${created.id}`)).data.edges.length, updated.edges.length);
    const invalid = await investigator.request('/transactions/ingest', { method: 'POST', body: {
      caseId: created.id,
      transactions: [{ ...transaction, id: `${transaction.id}-BAD`, source: 'nonexistent-node' }],
    } });
    assert.equal(invalid.response.status, 400);
    assert.equal((await otherInvestigator.request('/transactions/ingest', { method: 'POST', body: input })).response.status, 404);
    const retraced = (await investigator.request('/investigations', { method: 'POST', body: { caseId: created.id } })).data;
    assert.ok(retraced.nodes.some(node => node.id === addedWallet.id), 'Retracing retains analyst-added evidence');
    assert.ok(retraced.edges.some(edge => edge.id === transaction.id), 'Retracing retains ingested transactions');
  });

  it('validates attribution weights, recomputes scores and scopes configuration to the visitor', async () => {
    const original = (await investigator.request('/settings')).data;
    assert.equal(Object.values(original.weights).reduce((sum, value) => sum + value, 0), 100);
    const invalid = await investigator.request('/settings', { method: 'PUT', body: { weights: { ...original.weights, cluster: 99 } } });
    assert.equal(invalid.response.status, 400);
    const changedWeights = Object.fromEntries(Object.keys(original.weights).map(key => [key, key === 'external' ? 100 : 0]));
    const changed = await investigator.request('/settings', { method: 'PUT', body: { weights: changedWeights } });
    assert.equal(changed.response.status, 200);
    const rerun = await investigator.request('/investigations', { method: 'POST', body: { caseId: 'CR-2026-00192' } });
    assert.equal(rerun.response.status, 200);
    const evidence = rerun.data.attributions[0].evidence;
    assert.ok(evidence.length >= 7);
    assert.equal(evidence.reduce((sum, item) => sum + item.weight, 0), 100);
    assert.notEqual(rerun.data.attributions[0].confidence, seed.attributions[0].confidence, 'Confidence follows changed evidence weights');
    assert.deepEqual((await otherInvestigator.request('/settings')).data.weights, original.weights);
    await investigator.request('/settings', { method: 'PUT', body: { weights: original.weights } });
    await investigator.request('/investigations', { method: 'POST', body: { caseId: 'CR-2026-00192' } });
  });

  it('answers only from case evidence and returns verifiable internal citations', async () => {
    const references = new Set([
      ...seed.nodes.map(item => item.id), ...seed.edges.map(item => item.id),
      ...seed.nodes.map(item => item.address),
      ...seed.attributions.flatMap(item => item.evidence.map(evidence => evidence.id)),
      ...seed.riskIndicators.map(item => item.id),
      ...seed.nodes.map(item => item.cluster),
      ...seed.relatedCases.map(item => item.caseId),
    ]);
    for (const question of ['Why is this wallet high risk?', 'Which VASP is the strongest candidate?', 'What happened after the bridge transfer?', 'Which cases are related?']) {
      const result = await investigator.request('/assistant/CR-2026-00192', { method: 'POST', body: { question } });
      assert.equal(result.response.status, 200);
      assert.ok(result.data.answer.length > 20);
      assert.ok(result.data.citations.length, `An answer to '${question}' cites evidence`);
      for (const citation of result.data.citations) assert.ok(references.has(citation.id), `Citation ${citation.id} exists in current case`);
      assert.match(result.data.mode, /case-grounded/i);
    }
    const unknown = (await investigator.request('/assistant/CR-2026-00192', { method: 'POST', body: { question: 'What is the private key and home address of the wallet owner?' } })).data;
    assert.match(unknown.answer, /insufficient evidence/i);
    assert.equal(unknown.citations.length, 0);
  });

  it('records evidence, alert review and case status changes in the audit trail', async () => {
    const evidence = seed.attributions[0].evidence[0];
    assert.equal((await investigator.request(`/evidence/CR-2026-00192/${evidence.id}/view`, { method: 'POST', body: {} })).response.status, 200);
    const alerts = (await investigator.request('/alerts')).data;
    assert.ok(alerts.length >= 5);
    const reviewed = await investigator.request(`/alerts/${alerts[0].id}`, { method: 'PATCH', body: { status: 'Reviewed' } });
    assert.equal(reviewed.data.status, 'Reviewed');
    const foreignAlerts = (await otherInvestigator.request('/alerts')).data;
    assert.notEqual(foreignAlerts.find(item => item.id === alerts[0].id)?.status, 'Reviewed');
    const status = await investigator.request(`/cases/${created.id}`, { method: 'PATCH', body: { status: 'Monitoring' } });
    assert.equal(status.data.status, 'Monitoring');
    const audit = (await investigator.request('/audit')).data;
    assert.ok(audit.some(item => /Evidence Viewed/i.test(item.action)));
    assert.ok(audit.some(item => /Alert Reviewed/i.test(item.action)));
    assert.ok(audit.every(item => item.timestamp && item.user && item.object));
  });

  it('generates an actual readable PDF report and review-only information request package', async () => {
    const report = await investigator.request('/reports/CR-2026-00192/generate', { method: 'POST', body: {} });
    assert.ok(report.response.ok);
    assert.ok(report.data.id && report.data.url);
    const pdf = await investigator.request(`/reports/${report.data.id}`);
    assert.equal(pdf.response.status, 200);
    assert.match(pdf.response.headers.get('content-type'), /application\/pdf/);
    const bytes = Buffer.from(pdf.data);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(pdf.response.headers.get('x-evidence-sha256'), digest);
    assert.equal(report.data.sha256, digest);
    assert.ok(bytes.length > 5000, 'A substantive investigation report was generated');
    const path = join(server.directory, 'investigation.pdf');
    await writeFile(path, bytes);
    try {
      const contents = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
      for (const phrase of ['CRYPTO-TRACE INDIA', 'CR-2026-00192', 'VASP-X', 'SIMULATED', 'Evidence', 'Attribution', 'Related', 'verification']) {
        assert.match(contents, new RegExp(phrase, 'i'), `Report includes ${phrase}`);
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        assert.ok(bytes.length > 5000, 'PDF generated with substantive content');
      } else {
        throw err;
      }
    }
    const listed = (await investigator.request('/reports')).data;
    assert.ok(listed.some(item => item.id === report.data.id));
    assert.equal((await otherInvestigator.request(`/reports/${report.data.id}`)).response.status, 404);
    const packageResult = await investigator.request('/requests/CR-2026-00192/generate', { method: 'POST', body: {} });
    assert.equal(packageResult.response.status, 201);
    assert.match(JSON.stringify(packageResult.data), /VASP-X/);
    assert.match(JSON.stringify(packageResult.data), /review|authorized|not sent/i);
  });

  it('streams explicitly simulated events without representing them as live blockchain ingestion', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${server.baseUrl}/api/events`, { headers: { cookie: investigator.cookie }, signal: controller.signal });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/event-stream/);
      const reader = response.body.getReader();
      let payload = '';
      while (!payload.includes('DEMO STREAM')) {
        const { value, done } = await reader.read();
        if (done) break;
        payload += new TextDecoder().decode(value);
      }
      assert.match(payload, /DEMO STREAM/);
      await reader.cancel();
    } finally { clearTimeout(timeout); controller.abort(); }
  });

  it('persists the created investigation and visitor session across a server restart', async () => {
    await server.restart();
    const result = await investigator.request(`/cases/${created.id}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.data.status, 'Monitoring');
    assert.equal(result.data.reportedWallet, created.reportedWallet);
    const investigation = await investigator.request(`/investigations/${created.id}`);
    assert.equal(investigation.response.status, 200);
    assert.ok(investigation.data.edges.length > 0);
    assert.equal((await otherInvestigator.request(`/cases/${created.id}`)).response.status, 404);
  });
});
