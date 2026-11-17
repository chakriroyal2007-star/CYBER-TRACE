/**
 * Dynamic Prefix Trie (Radix Tree) for O(L) Identifier Search
 * Used for real-time autocomplete across Wallets, UPI VPAs, Case IDs, and VASPs.
 */

export class TrieNode {
  constructor(char = '') {
    this.char = char;
    this.children = new Map();
    this.isTerminal = false;
    this.metadata = null;
    this.frequency = 0;
  }
}

export class PrefixTrie {
  constructor() {
    this.root = new TrieNode();
    this.totalWords = 0;
    this.totalNodes = 1;
  }

  /**
   * Insert a string key and its associated entity metadata
   * Time Complexity: O(L) where L is key length
   * Space Complexity: O(L) in the worst case (new branch)
   */
  insert(key, metadata = {}) {
    if (!key || typeof key !== 'string') return;
    const normalized = key.trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode(char));
        this.totalNodes++;
      }
      current = current.children.get(char);
    }

    if (!current.isTerminal) {
      this.totalWords++;
    }
    current.isTerminal = true;
    current.frequency++;
    current.metadata = {
      ...metadata,
      rawKey: key,
      normalizedKey: normalized,
      indexedAt: Date.now()
    };
  }

  /**
   * Exact search for a key in the Trie
   * Time Complexity: O(L)
   */
  search(key) {
    if (!key || typeof key !== 'string') return null;
    const normalized = key.trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current.children.has(char)) return null;
      current = current.children.get(char);
    }

    return current.isTerminal ? current.metadata : null;
  }

  /**
   * Check if any key starts with the given prefix
   * Time Complexity: O(P) where P is prefix length
   */
  startsWith(prefix) {
    if (!prefix || typeof prefix !== 'string') return false;
    const normalized = prefix.trim().toLowerCase();
    let current = this.root;

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current.children.has(char)) return false;
      current = current.children.get(char);
    }
    return true;
  }

  /**
   * Autocomplete matches starting with prefix
   * Time Complexity: O(P + K) where P is prefix length and K is sub-tree exploration cost
   */
  autocomplete(prefix, limit = 20) {
    if (!prefix || typeof prefix !== 'string') return [];
    const normalized = prefix.trim().toLowerCase();
    let current = this.root;
    const prefixPath = [];

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (!current.children.has(char)) return [];
      current = current.children.get(char);
      prefixPath.push(char);
    }

    const results = [];
    // Depth-First Search collect terminal nodes under prefix
    function dfs(node) {
      if (results.length >= limit) return;
      if (node.isTerminal && node.metadata) {
        results.push(node.metadata);
      }
      for (const [, child] of node.children) {
        dfs(child);
        if (results.length >= limit) return;
      }
    }

    dfs(current);
    return results;
  }

  /**
   * Generate step-by-step traversal steps for educational visualization
   */
  simulateSearch(prefix) {
    const normalized = (prefix || '').trim().toLowerCase();
    const steps = [];
    let current = this.root;
    let accumulated = '';

    steps.push({
      step: 1,
      action: 'INIT_TRIE',
      char: 'ROOT',
      accumulated: '',
      activeNode: 'ROOT',
      childNodes: Array.from(this.root.children.keys()),
      explanation: 'Starting prefix query from Trie Root node (branching factor: ' + this.root.children.size + ' characters).'
    });

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      accumulated += char;
      const hasBranch = current.children.has(char);

      if (hasBranch) {
        current = current.children.get(char);
        steps.push({
          step: steps.length + 1,
          action: 'TRAVERSE_EDGE',
          char,
          accumulated,
          activeNode: accumulated,
          isTerminal: current.isTerminal,
          frequency: current.frequency,
          childNodes: Array.from(current.children.keys()),
          explanation: `Traversing edge '${char}' -> Node '${accumulated}'. Next available branches: [${Array.from(current.children.keys()).join(', ')}].`
        });
      } else {
        steps.push({
          step: steps.length + 1,
          action: 'BRANCH_MISS',
          char,
          accumulated,
          activeNode: 'NONE',
          explanation: `Character '${char}' does not exist under node '${accumulated.slice(0, -1)}'. Prefix lookup terminated with 0 matches.`
        });
        return { steps, matches: [] };
      }
    }

    const matches = this.autocomplete(prefix, 10);
    steps.push({
      step: steps.length + 1,
      action: 'COLLECT_MATCHES',
      char: 'TERMINALS',
      accumulated,
      matchesCount: matches.length,
      explanation: `Prefix '${accumulated}' verified. DFS subtree scan retrieved ${matches.length} matching entities in O(L) time.`
    });

    return { steps, matches };
  }

  getStats() {
    return {
      totalWords: this.totalWords,
      totalNodes: this.totalNodes,
      rootBranches: this.root.children.size
    };
  }
}
