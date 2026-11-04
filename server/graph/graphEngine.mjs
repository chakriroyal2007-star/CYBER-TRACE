import { readFileSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatasetIngestionPipeline, DEFAULT_DATASET_DIR } from '../dataset/ingestion.mjs';
import {
  bfsTraversal,
  dfsTraversal,
  dijkstraShortestPath,
  findConnectedComponents,
  getTopSuspiciousTransactions,
  slidingWindowAnalysis,
  getNeighborhood
} from './algorithms.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class GraphEngine {
  constructor(datasetDir = DEFAULT_DATASET_DIR) {
    this.datasetDir = datasetDir;
    this.pipeline = new DatasetIngestionPipeline(datasetDir);
    this.nodeIndex = new Map();
    this.adjacency = new Map();
    this.reverseAdjacency = new Map();
    this.featureOffsets = null;
    this.stats = null;
    this.modelEvaluation = null;
    this.isLoaded = false;
    this.featuresFd = null;
    const featuresFilename = ['elliptic', 'txs', 'features.csv'].join('_');
    this.featuresPath = resolve(datasetDir, featuresFilename);
    this.offsetsPath = resolve(datasetDir, 'features_offsets.json');
    this.evalPath = resolve(datasetDir, 'model_evaluation.json');
  }

  async initialize() {
    if (this.isLoaded) return this;
    const startTime = Date.now();

    // 1. Run pipeline to ingest classes, edges, and scores
    const ingestionResult = await this.pipeline.execute();
    this.nodeIndex = ingestionResult.nodeMap;
    this.adjacency = ingestionResult.adjacency;
    this.reverseAdjacency = ingestionResult.reverseAdjacency;
    this.stats = ingestionResult.stats;

    // 2. Load feature offsets for instant O(1) random feature retrieval
    if (existsSync(this.offsetsPath)) {
      try {
        this.featureOffsets = JSON.parse(readFileSync(this.offsetsPath, 'utf8'));
      } catch (err) {
        console.warn('Feature offsets failed to parse, features on-demand fallback enabled:', err.message);
      }
    }

    // 3. Open features file descriptor for random seeking
    if (existsSync(this.featuresPath)) {
      try {
        this.featuresFd = openSync(this.featuresPath, 'r');
      } catch (err) {
        console.warn('Could not open features file descriptor:', err.message);
      }
    }

    // 4. Load model evaluation metrics
    if (existsSync(this.evalPath)) {
      try {
        this.modelEvaluation = JSON.parse(readFileSync(this.evalPath, 'utf8'));
      } catch (err) {
        console.warn('Model evaluation metrics not found:', err.message);
      }
    }

    this.isLoaded = true;
    this.loadDurationMs = Date.now() - startTime;
    return this;
  }

  hasNode(txId) {
    return this.nodeIndex.has(String(txId));
  }

  getNode(txId) {
    return this.nodeIndex.get(String(txId)) || null;
  }

  getNeighbors(txId) {
    return this.adjacency.get(String(txId)) || [];
  }

  getIncomingNeighbors(txId) {
    return this.reverseAdjacency.get(String(txId)) || [];
  }

  /**
   * Fast O(1) random retrieval of the 165 features for any transaction.
   * Takes < 0.1ms via file byte offset.
   */
  getTransactionFeatures(txId) {
    const id = String(txId);
    if (!this.featuresFd || !this.featureOffsets || this.featureOffsets[id] === undefined) {
      return null;
    }

    const offset = this.featureOffsets[id];
    const buffer = Buffer.alloc(8192);
    readSync(this.featuresFd, buffer, 0, 8192, offset);

    const line = buffer.toString('utf8').split('\n')[0];
    const parts = line.split(',');
    if (parts.length < 3) return null;

    const timeStep = parseInt(parts[1], 10);
    const rawFeatures = parts.slice(2).map(Number);

    // Features breakdown according to Elliptic paper:
    // First 93: local features (transaction fee, inputs/outputs count, BTC volume)
    // Next 72: aggregated features (neighbor min, max, std, mean)
    return {
      txId: id,
      timeStep,
      featureCount: rawFeatures.length,
      localFeatures: rawFeatures.slice(0, 93),
      aggregatedFeatures: rawFeatures.slice(93),
      allFeatures: rawFeatures
    };
  }

  // Graph Traversal Algorithms
  bfs(startTxId, options = {}) {
    return bfsTraversal(this, String(startTxId), options);
  }

  dfs(startTxId, options = {}) {
    return dfsTraversal(this, String(startTxId), options);
  }

  dijkstra(startTxId, targetTxId, weightType = 'hop') {
    return dijkstraShortestPath(this, String(startTxId), String(targetTxId), weightType);
  }

  connectedComponents(transactionIds) {
    const ids = transactionIds.map(String);
    return findConnectedComponents(this, ids);
  }

  topSuspicious(k = 10, filter = {}) {
    return getTopSuspiciousTransactions(this, k, filter);
  }

  slidingWindow(windowSize = 3, thresholdBurst = 1.3) {
    return slidingWindowAnalysis(this, windowSize, thresholdBurst);
  }

  neighborhood(txId, depth = 1) {
    return getNeighborhood(this, String(txId), depth);
  }

  getSubgraph(centerId, depth = 1, limit = 60) {
    const id = String(centerId);
    if (!this.hasNode(id)) return { centerId: id, found: false, nodes: [], edges: [] };

    const visitedNodes = new Set([id]);
    const queue = [{ id, currentDepth: 0 }];
    const edges = [];
    const edgeSet = new Set();

    while (queue.length > 0 && visitedNodes.size < limit) {
      const { id: currId, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      // Outgoing neighbors
      const outNeighbors = this.getNeighbors(currId);
      for (const nextId of outNeighbors) {
        const edgeKey = `${currId}->${nextId}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ id: `E-${edgeKey}`, source: currId, target: nextId });
        }
        if (!visitedNodes.has(nextId) && visitedNodes.size < limit) {
          visitedNodes.add(nextId);
          queue.push({ id: nextId, currentDepth: currentDepth + 1 });
        }
      }

      // Incoming neighbors (for depth 1 or direct inputs)
      if (currentDepth === 0) {
        const inNeighbors = this.getIncomingNeighbors(currId);
        for (const prevId of inNeighbors) {
          const edgeKey = `${prevId}->${currId}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({ id: `E-${edgeKey}`, source: prevId, target: currId });
          }
          if (!visitedNodes.has(prevId) && visitedNodes.size < limit) {
            visitedNodes.add(prevId);
          }
        }
      }
    }

    // Format nodes
    const nodes = [];
    for (const nid of visitedNodes) {
      const nData = this.getNode(nid);
      nodes.push({
        id: nid,
        label: `Tx ${nid}`,
        timeStep: nData?.timeStep ?? null,
        knownLabel: nData?.label || 'unknown',
        predictedClass: nData?.predictedClass || 'licit',
        probability: nData?.probability ?? 0.5,
        riskScore: nData?.riskScore ?? (nData?.label === 'illicit' ? 90 : nData?.label === 'licit' ? 20 : 50),
        inDegree: this.getIncomingNeighbors(nid).length,
        outDegree: this.getNeighbors(nid).length,
        isCenter: nid === id
      });
    }

    return {
      centerId: id,
      found: true,
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        illicitCount: nodes.filter(n => n.knownLabel === 'illicit').length,
        licitCount: nodes.filter(n => n.knownLabel === 'licit').length,
        unknownCount: nodes.filter(n => n.knownLabel === 'unknown').length
      }
    };
  }

  getStats() {
    return {
      ...this.stats,
      inMemoryNodes: this.nodeIndex.size,
      inMemoryAdjacencyEntries: this.adjacency.size,
      inMemoryReverseEntries: this.reverseAdjacency.size,
      loadDurationMs: this.loadDurationMs || 0,
      modelLoaded: Boolean(this.modelEvaluation),
      featuresIndexed: Boolean(this.featureOffsets)
    };
  }

  close() {
    if (this.featuresFd !== null) {
      try {
        closeSync(this.featuresFd);
      } catch {}
      this.featuresFd = null;
    }
  }
}

// Singleton graph instance
let globalGraphInstance = null;

export async function getGraphEngine(datasetDir = DEFAULT_DATASET_DIR) {
  if (!globalGraphInstance) {
    globalGraphInstance = new GraphEngine(datasetDir);
    await globalGraphInstance.initialize();
  }
  return globalGraphInstance;
}
