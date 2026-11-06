import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blockchainManager, VERIFICATION_STATUS, MempoolSpaceProvider, EthereumProvider, TronProvider } from '../server/blockchain/provider.mjs';
import { client, launchServer } from './helpers.mjs';

test('Blockchain Provider Integrations & Watchtower Intelligence', async (t) => {
  const server = await launchServer();
  const officer = client(server.baseUrl);

  t.after(async () => {
    await server.close();
  });

  await t.test('authenticates officer session', async () => {
    const res = await officer.request('/auth/demo-officer', { method: 'POST', body: {} });
    assert.equal(res.response.status, 200);
  });

  await t.test('validates address formats correctly across Bitcoin, Ethereum, and TRON', async () => {
    // Bitcoin addresses
    assert.ok(blockchainManager.validateAddress('Bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'));
    assert.ok(blockchainManager.validateAddress('Bitcoin', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'));
    assert.ok(blockchainManager.validateAddress('Bitcoin', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'));
    assert.equal(blockchainManager.validateAddress('Bitcoin', '0x12345'), false);

    // Ethereum addresses
    assert.ok(blockchainManager.validateAddress('Ethereum', '0x71C67Ed30791Fc5E04505299F39B755b4237E935'));
    assert.ok(blockchainManager.validateAddress('Polygon', '0x28C6c06298d514Db089934071355E5743bf21d60'));
    assert.equal(blockchainManager.validateAddress('Ethereum', 'not-an-eth-address'), false);

    // TRON addresses
    assert.ok(blockchainManager.validateAddress('TRON', 'TNPeeaaTKFZLLqZf48jZZBxfkKxGfTQ9PZ'));
    assert.equal(blockchainManager.validateAddress('TRON', '0x71C67Ed30791Fc5E04505299F39B755b4237E935'), false);
  });

  await t.test('validates transaction hash formats and rejects invalid references', async () => {
    const invalidRes = await officer.request('/blockchain/verify', {
      method: 'POST',
      body: {
        chain: 'Bitcoin',
        txHash: 'invalid-hash-too-short'
      }
    });
    assert.equal(invalidRes.response.status, 200);
    assert.equal(invalidRes.data.status, VERIFICATION_STATUS.INVALID_REFERENCE);
    assert.equal(invalidRes.data.verified, false);
  });

  await t.test('handles unsupported blockchain networks gracefully', async () => {
    const unsuppRes = await officer.request('/blockchain/verify', {
      method: 'POST',
      body: {
        chain: 'Cardano',
        txHash: '0000000000000000000000000000000000000000000000000000000000000000'
      }
    });
    assert.equal(unsuppRes.response.status, 200);
    assert.equal(unsuppRes.data.status, VERIFICATION_STATUS.UNSUPPORTED_NETWORK);
    assert.equal(unsuppRes.data.verified, false);
  });

  await t.test('retrieves provider health status', async () => {
    const healthRes = await officer.request('/blockchain/health');
    assert.equal(healthRes.response.status, 200);
    assert.ok(healthRes.data.bitcoin);
    assert.ok(healthRes.data.ethereum);
    assert.ok(healthRes.data.polygon);
    assert.ok(healthRes.data.tron);
  });

  await t.test('supports Watchtower address monitoring lifecycle', async () => {
    // 1. Add watched address
    const addRes = await officer.request('/watchtower', {
      method: 'POST',
      body: {
        chain: 'Bitcoin',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        label: 'Satoshi Genesis Monitor',
        caseId: 'CR-2026-00192'
      }
    });
    assert.equal(addRes.response.status, 201);
    const watchId = addRes.data.id;

    // 2. List watchlist
    const listRes = await officer.request('/watchtower');
    assert.equal(listRes.response.status, 200);
    const found = listRes.data.find(w => w.id === watchId);
    assert.ok(found);
    assert.equal(found.address, '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

    // 3. Remove watched address
    const delRes = await officer.request(`/watchtower/${watchId}`, { method: 'DELETE' });
    assert.equal(delRes.response.status, 200);
    assert.equal(delRes.data.ok, true);
  });

  await t.test('retrieves cross-case intelligence correlations', async () => {
    const crossRes = await officer.request('/cross-case?q=0x71C67Ed30791Fc5E04505299F39B755b4237E935');
    assert.equal(crossRes.response.status, 200);
    assert.ok(crossRes.data.totalMatches !== undefined);
  });
});
