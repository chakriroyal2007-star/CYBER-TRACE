process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDataset,
  getExplorerUrl,
  VALID_PROVENANCE_TAGS
} from '../server/analytics.mjs';
import { Store } from '../server/db.mjs';

test('Phase 4: Showcase Hybrid Cases with Honest Provenance Tags', async (t) => {
  await t.test('4.1 Provenance Tags & Explorer URL Helper specification', () => {
    assert.deepEqual(
      [...VALID_PROVENANCE_TAGS],
      ['REAL_PUBLIC_ONCHAIN', 'USER_UPLOADED', 'INSTITUTION_RESPONSE', 'SYNTHETIC_ILLUSTRATIVE', 'ML_INFERRED'],
      'VALID_PROVENANCE_TAGS must contain exactly the 5 specified honesty tags'
    );

    // Explorer URL tests
    const ethAddr = getExplorerUrl('Ethereum', 'address', '0x6e37390963c6A00Eb040479b545E47f702956c40');
    assert.equal(ethAddr, 'https://etherscan.io/address/0x6e37390963c6A00Eb040479b545E47f702956c40');

    const ethTx = getExplorerUrl('Ethereum', 'tx', '0x20332840aabbccddeeff0011223344556677889900aabbccddeeff0011223344');
    assert.equal(ethTx, 'https://etherscan.io/tx/0x20332840aabbccddeeff0011223344556677889900aabbccddeeff0011223344');

    const polyAddr = getExplorerUrl('Polygon', 'address', '0x8849E256C72b6b02a249856A9F784c0E06b02D68');
    assert.equal(polyAddr, 'https://polygonscan.com/address/0x8849E256C72b6b02a249856A9F784c0E06b02D68');

    const btcAddr = getExplorerUrl('Bitcoin', 'address', 'bc1qtest123');
    assert.equal(btcAddr, 'https://www.blockchain.com/explorer/addresses/btc/bc1qtest123');

    const tronAddr = getExplorerUrl('TRON', 'address', 'TTest123');
    assert.equal(tronAddr, 'https://tronscan.org/#/address/TTest123');

    assert.equal(getExplorerUrl('Ethereum', 'address', null), null);
  });

  await t.test('4.2 Showcase Case A (CR-2026-00192): UPI-to-Crypto Mule Network + WazirX Exploit aftermath', () => {
    const caseA = {
      id: 'CR-2026-00192',
      chain: 'Ethereum',
      victimLoss: 812450,
      fraudType: 'UPI Mule Network to Cross-Chain Crypto',
      reportedWallet: '0x28C6c06298d514Db089934071355E5743bf21d60'
    };

    const dataset = buildDataset(caseA);
    assert.ok(dataset.nodes.length >= 18, 'Case A must preserve graph topology with at least 18 nodes');
    assert.ok(dataset.edges.length >= 40, 'Case A must preserve graph topology with at least 40 edges');

    // 1. Check all nodes have valid provenance tags
    for (const node of dataset.nodes) {
      assert.ok(
        VALID_PROVENANCE_TAGS.includes(node.provenance),
        `Node ${node.id} (${node.label}) must have a valid provenance tag, got: ${node.provenance}`
      );
      if (node.provenance === 'REAL_PUBLIC_ONCHAIN') {
        assert.ok(node.explorerUrl, `Real on-chain node ${node.id} must have an explorerUrl`);
        assert.match(node.explorerUrl, /^https:\/\/(etherscan\.io|polygonscan\.com)/);
      }
    }

    // 2. Check all edges have valid provenance tags
    for (const edge of dataset.edges) {
      assert.ok(
        VALID_PROVENANCE_TAGS.includes(edge.provenance),
        `Edge ${edge.id} must have a valid provenance tag, got: ${edge.provenance}`
      );
      if (edge.provenance === 'REAL_PUBLIC_ONCHAIN') {
        assert.ok(edge.explorerUrl, `Real on-chain edge ${edge.id} must have an explorerUrl`);
        assert.match(edge.explorerUrl, /^https:\/\/(etherscan\.io|polygonscan\.com)/);
      }
    }

    // 3. Verify specific required hops for Case A
    // Hop 0: Victim payment
    assert.equal(dataset.nodes[0].provenance, 'USER_UPLOADED');
    assert.match(dataset.nodes[0].label, /victim/i);

    // Hop 1: Mule 1
    assert.equal(dataset.nodes[1].provenance, 'SYNTHETIC_ILLUSTRATIVE');
    assert.match(dataset.nodes[1].label, /Mule Account #1/i);

    // Hop 2: Mule 2
    assert.equal(dataset.nodes[2].provenance, 'SYNTHETIC_ILLUSTRATIVE');
    assert.match(dataset.nodes[2].label, /Mule Account #2/i);

    // Hop 3: Domestic Exchange P2P Desk
    assert.equal(dataset.nodes[3].provenance, 'SYNTHETIC_ILLUSTRATIVE');
    assert.match(dataset.nodes[3].label, /P2P Desk/i);

    // Hop 4: WazirX Exploiter Primary Receiver
    assert.equal(dataset.nodes[4].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[4].address.toLowerCase(), '0x6e37390963c6a00eb040479b545e47f702956c40'.toLowerCase());
    assert.equal(dataset.nodes[4].explorerUrl, 'https://etherscan.io/address/0x6e37390963c6A00Eb040479b545E47f702956c40');

    // Hop 6: Across Bridge Router
    assert.equal(dataset.nodes[6].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[6].address.toLowerCase(), '0x3d4cc8a61c7528fd86c55cfe061a78dcba48edd1'.toLowerCase());

    // Hop 7: Polygon Recipient Hopper
    assert.equal(dataset.nodes[7].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[7].chain, 'Polygon');
    assert.equal(dataset.nodes[7].address.toLowerCase(), '0x8849e256c72b6b02a249856a9f784c0e06b02d68'.toLowerCase());
    assert.equal(dataset.nodes[7].explorerUrl, 'https://polygonscan.com/address/0x8849E256C72b6b02a249856A9F784c0E06b02D68');

    // VASP Exits
    const vaspNodes = dataset.nodes.filter(n => n.type === 'vasp');
    assert.ok(vaspNodes.length >= 3, 'Must have at least 3 VASP deposit accounts');
    for (const vasp of vaspNodes) {
      assert.equal(vasp.provenance, 'INSTITUTION_RESPONSE');
    }
  });

  await t.test('4.3 Showcase Case B (CR-2026-00193): Phishing / Pink Drainer Incident + Cross-Chain Bridge', () => {
    const caseB = {
      id: 'CR-2026-00193',
      chain: 'Ethereum',
      victimLoss: 812450,
      fraudType: 'Phishing Drainer Scam (Pink Drainer Incident)',
      reportedWallet: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88'
    };

    const dataset = buildDataset(caseB);
    assert.ok(dataset.nodes.length >= 18, 'Case B must have at least 18 nodes');

    // Node 0: Reported victim wallet
    assert.equal(dataset.nodes[0].provenance, 'USER_UPLOADED');

    // Node 1: Pink Drainer Malicious Operator
    assert.equal(dataset.nodes[1].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[1].address.toLowerCase(), '0x4c2a5C53Ac20c8fB4a84e339F06A32dFdCa24424'.toLowerCase());
    assert.equal(dataset.nodes[1].explorerUrl, 'https://etherscan.io/address/0x4c2a5C53Ac20c8fB4a84e339F06A32dFdCa24424');

    // Node 6: Across Bridge Router
    assert.equal(dataset.nodes[6].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[6].address.toLowerCase(), '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1'.toLowerCase());

    // Node 7: Polygon Recipient Hopper
    assert.equal(dataset.nodes[7].provenance, 'REAL_PUBLIC_ONCHAIN');
    assert.equal(dataset.nodes[7].chain, 'Polygon');
    assert.equal(dataset.nodes[7].address.toLowerCase(), '0x8849E256C72b6b02a249856A9F784c0E06b02D68'.toLowerCase());

    // Every node and edge carries valid provenance
    for (const node of dataset.nodes) {
      assert.ok(VALID_PROVENANCE_TAGS.includes(node.provenance));
    }
    for (const edge of dataset.edges) {
      assert.ok(VALID_PROVENANCE_TAGS.includes(edge.provenance));
    }
  });

  await t.test('4.4 Forensic Citations (docs/CASE_SOURCES.md) verification', () => {
    const caseSourcesPath = join(process.cwd(), 'docs', 'CASE_SOURCES.md');
    assert.ok(existsSync(caseSourcesPath), 'docs/CASE_SOURCES.md must exist');

    const content = readFileSync(caseSourcesPath, 'utf8');
    assert.match(content, /0x6e37390963c6A00Eb040479b545E47f702956c40/i, 'Must cite WazirX exploiter address');
    assert.match(content, /0x4c2a5C53Ac20c8fB4a84e339F06A32dFdCa24424/i, 'Must cite Pink Drainer address');
    assert.match(content, /0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1/i, 'Must cite Across Bridge router address');
    assert.match(content, /0x8849E256C72b6b02a249856A9F784c0E06b02D68/i, 'Must cite Polygon consolidation address');
    assert.match(content, /https:\/\/etherscan\.io/, 'Must cite Etherscan URL');
    assert.match(content, /https:\/\/polygonscan\.com/, 'Must cite Polygonscan URL');
    assert.match(content, /Block Height|Block/i, 'Must cite block heights');
  });

  await t.test('4.5 Database Seed Complaints contain Showcase Cases A and B', () => {
    const store = new Store(':memory:');
    const complaints = store.listComplaints();
    const caseASeed = complaints.find(c => c.id === 'CR-2026-00192');
    assert.ok(caseASeed, 'Seed complaints must contain CR-2026-00192');
    assert.equal(caseASeed.provenanceTags?.caseType, 'HYBRID');
    assert.match(caseASeed.description, /UPI-to-crypto mule network/i);

    const caseBSeed = complaints.find(c => c.id === 'CR-2026-00193');
    assert.ok(caseBSeed, 'Seed complaints must contain CR-2026-00193');
    assert.equal(caseBSeed.provenanceTags?.caseType, 'HYBRID');
    assert.match(caseBSeed.description, /Phishing scam leading directly to an on-chain drain/i);
  });
});
