/**
 * Dynamic LRU Cache (Least Recently Used Cache)
 * Implemented with a Doubly Linked List + Hash Map for strictly O(1) Get and Put operations.
 * Used for caching blockchain RPC query responses and forensic node risk evaluations.
 */

export class LRUNode {
  constructor(key = null, value = null) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.accessCount = 1;
    this.updatedAt = Date.now();
  }
}

export class LRUCache {
  constructor(capacity = 5) {
    this.capacity = Math.max(1, capacity);
    this.map = new Map();
    this.head = new LRUNode('SENTINEL_HEAD', null);
    this.tail = new LRUNode('SENTINEL_TAIL', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Internal helper: add node directly behind sentinel head (Most Recently Used)
   */
  _addNode(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Internal helper: detach node from doubly linked list
   */
  _removeNode(node) {
    const prev = node.prev;
    const next = node.next;
    prev.next = next;
    next.prev = prev;
  }

  /**
   * Internal helper: move existing node to head (Cache Hit)
   */
  _moveToHead(node) {
    this._removeNode(node);
    this._addNode(node);
  }

  /**
   * Internal helper: pop least recently used node from tail (Eviction)
   */
  _popTail() {
    const res = this.tail.prev;
    this._removeNode(res);
    return res;
  }

  /**
   * Get value by key in O(1) time
   */
  get(key) {
    const node = this.map.get(key);
    if (!node) {
      this.misses++;
      return null;
    }
    node.accessCount++;
    node.updatedAt = Date.now();
    this._moveToHead(node);
    this.hits++;
    return node.value;
  }

  /**
   * Put key-value pair in O(1) time
   */
  put(key, value) {
    const node = this.map.get(key);
    if (node) {
      node.value = value;
      node.accessCount++;
      node.updatedAt = Date.now();
      this._moveToHead(node);
      return { action: 'UPDATE', key, evicted: null };
    }

    const newNode = new LRUNode(key, value);
    this.map.set(key, newNode);
    this._addNode(newNode);

    let evictedKey = null;
    if (this.map.size > this.capacity) {
      const tail = this._popTail();
      this.map.delete(tail.key);
      evictedKey = tail.key;
    }

    return {
      action: evictedKey ? 'INSERT_AND_EVICT' : 'INSERT',
      key,
      evicted: evictedKey
    };
  }

  getSnapshot() {
    const items = [];
    let curr = this.head.next;
    while (curr !== this.tail) {
      items.push({
        key: curr.key,
        value: curr.value,
        accessCount: curr.accessCount,
        updatedAt: curr.updatedAt
      });
      curr = curr.next;
    }
    return items;
  }

  getStats() {
    return {
      capacity: this.capacity,
      size: this.map.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: (this.hits + this.misses) > 0 ? (this.hits / (this.hits + this.misses)).toFixed(2) : '0.00'
    };
  }

  /**
   * Simulate a sequence of operations for step-by-step visualizer playback
   */
  simulateOperations(operations = []) {
    const steps = [];
    steps.push({
      step: 1,
      action: 'INITIALIZE_CACHE',
      explanation: `Initialized LRU Cache with capacity = ${this.capacity}. Doubly linked list created with sentinel HEAD and TAIL.`,
      snapshot: this.getSnapshot(),
      stats: this.getStats()
    });

    for (const op of operations) {
      if (op.type === 'PUT') {
        const res = this.put(op.key, op.value);
        steps.push({
          step: steps.length + 1,
          action: res.action,
          key: op.key,
          value: op.value,
          evicted: res.evicted,
          explanation: res.evicted
            ? `PUT('${op.key}'): Capacity exceeded. Evicted least recently used item '${res.evicted}' from tail; spliced new node to head.`
            : `PUT('${op.key}'): Added new node to MRU head. Cache size: ${this.map.size}/${this.capacity}.`,
          snapshot: this.getSnapshot(),
          stats: this.getStats()
        });
      } else if (op.type === 'GET') {
        const val = this.get(op.key);
        steps.push({
          step: steps.length + 1,
          action: val !== null ? 'CACHE_HIT' : 'CACHE_MISS',
          key: op.key,
          value: val,
          explanation: val !== null
            ? `GET('${op.key}'): Cache HIT! Spliced node '${op.key}' directly to HEAD (Most Recently Used).`
            : `GET('${op.key}'): Cache MISS! Key not present in HashMap index.`,
          snapshot: this.getSnapshot(),
          stats: this.getStats()
        });
      }
    }

    return steps;
  }
}
