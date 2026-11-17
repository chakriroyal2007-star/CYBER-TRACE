import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PrefixTrie } from '../server/graph/prefixTrie.mjs';
import { LRUCache } from '../server/graph/lruCache.mjs';
import { runDsaSimulation, DSA_CATALOG } from '../server/graph/dsaSimulator.mjs';

describe('Non-Graph Dynamic Data Structures (Prefix Trie & LRU Cache)', () => {
  it('PrefixTrie: correctly inserts and autocompletes prefixes in O(L) time', () => {
    const trie = new PrefixTrie();
    trie.insert('0x6e37e96b34b17f52f36070a75f8485293297a7de', { label: 'WazirX Exploiter', risk: 95 });
    trie.insert('0x35fe73e6a6f67977a7b8c8d1bb765b214a1e9411', { label: 'Layering Wallet', risk: 90 });
    trie.insert('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', { label: 'Bitcoin Genesis', risk: 5 });
    trie.insert('TNPeeaaTKFZLLqZf48jZZBxfkKxGfTQ9PZ', { label: 'TRON Mule', risk: 85 });
    trie.insert('victim@okhdfcbank', { label: 'Victim VPA', risk: 10 });
    trie.insert('victim.second@sbi', { label: 'Second Victim', risk: 10 });

    assert.equal(trie.startsWith('0x6e'), true);
    assert.equal(trie.startsWith('1a1z'), true);
    assert.equal(trie.startsWith('nonexistent'), false);

    const matches = trie.autocomplete('0x');
    assert.equal(matches.length, 2);
    assert.ok(matches.some(m => m.label === 'WazirX Exploiter'));
    assert.ok(matches.some(m => m.label === 'Layering Wallet'));

    const vpaMatches = trie.autocomplete('victim');
    assert.equal(vpaMatches.length, 2);

    const sim = trie.simulateSearch('0x6e');
    assert.ok(sim.steps.length >= 3);
    assert.equal(sim.steps[0].action, 'INIT_TRIE');
    assert.equal(sim.steps[1].char, '0');
    assert.equal(sim.steps[2].char, 'x');
  });

  it('LRUCache: provides strictly O(1) Get and Put with tail eviction', () => {
    const cache = new LRUCache(3);
    cache.put('A', 1);
    cache.put('B', 2);
    cache.put('C', 3);

    assert.equal(cache.get('A'), 1); // A moved to head (MRU)
    assert.equal(cache.get('B'), 2); // B moved to head (MRU)

    // Inserting D should evict C (least recently used)
    const res = cache.put('D', 4);
    assert.equal(res.action, 'INSERT_AND_EVICT');
    assert.equal(res.evicted, 'C');

    assert.equal(cache.get('C'), null); // Miss
    assert.equal(cache.get('D'), 4);
    assert.equal(cache.get('A'), 1);

    const stats = cache.getStats();
    assert.equal(stats.capacity, 3);
    assert.equal(stats.size, 3);
    assert.ok(stats.hits >= 4);
    assert.equal(stats.misses, 1);
  });

  it('DSA Simulator: correctly runs prefix-trie and lru-cache simulations', () => {
    const trieEntry = DSA_CATALOG.find(e => e.id === 'prefix-trie');
    assert.ok(trieEntry, 'prefix-trie catalog entry exists');
    assert.equal(trieEntry.category, 'String & Retrieval Structures (Non-Graph)');

    const lruEntry = DSA_CATALOG.find(e => e.id === 'lru-cache');
    assert.ok(lruEntry, 'lru-cache catalog entry exists');
    assert.equal(lruEntry.category, 'Memory & Storage Optimization (Non-Graph)');

    const trieSim = runDsaSimulation({ algorithm: 'prefix-trie', presetId: 'case-00192' });
    assert.ok(trieSim.steps.length > 0);
    assert.ok(trieSim.summary.forensicFinding.courtProof.includes('Prefix Trie'));

    const lruSim = runDsaSimulation({ algorithm: 'lru-cache', presetId: 'case-00192' });
    assert.ok(lruSim.steps.length > 0);
    assert.ok(lruSim.summary.forensicFinding.courtProof.includes('LRU Cache'));
  });
});
