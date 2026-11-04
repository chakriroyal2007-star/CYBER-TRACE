import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DATASET_DIR = resolve(__dirname, '../../data/elliptic');
const FEATURES_FILENAME = ['elliptic', 'txs', 'features.csv'].join('_');

// Static trace anchors for Vercel Serverless Function bundling
try {
  readFileSync(resolve(__dirname, '../../data/elliptic/elliptic_txs_classes.csv'), { flag: 'r' });
  readFileSync(resolve(__dirname, '../../data/elliptic/elliptic_txs_edgelist.csv'), { flag: 'r' });
  readFileSync(resolve(__dirname, '../../data/elliptic/model_scores.json'), { flag: 'r' });
  readFileSync(resolve(__dirname, '../../data/elliptic/model_evaluation.json'), { flag: 'r' });
  readFileSync(resolve(__dirname, '../../data/elliptic/features_offsets.json'), { flag: 'r' });
} catch {}

export class DatasetIngestionPipeline {
  constructor(datasetDir = DEFAULT_DATASET_DIR) {
    this.datasetDir = datasetDir;
    this.classesPath = resolve(datasetDir, 'elliptic_txs_classes.csv');
    this.edgesPath = resolve(datasetDir, 'elliptic_txs_edgelist.csv');
    this.featuresPath = resolve(datasetDir, FEATURES_FILENAME);
    this.scoresPath = resolve(datasetDir, 'model_scores.json');
    this.evalPath = resolve(datasetDir, 'model_evaluation.json');

    this.stats = {
      totalNodes: 0,
      totalEdges: 0,
      classes: { illicit: 0, licit: 0, unknown: 0 },
      timeSteps: {},
      validationErrors: [],
      duplicateEdges: 0,
      missingNodesInEdges: 0,
      ingestedAt: null,
      ingestionDurationMs: 0
    };
  }

  validateFiles() {
    const missing = [];
    if (!existsSync(this.classesPath)) missing.push('elliptic_txs_classes.csv');
    if (!existsSync(this.edgesPath)) missing.push('elliptic_txs_edgelist.csv');
    if (missing.length) {
      throw new Error(`Dataset files missing in ${this.datasetDir}: ${missing.join(', ')}`);
    }
    if (!existsSync(this.featuresPath)) {
      console.warn(`[DatasetIngestionPipeline] elliptic_txs_features.csv (658MB) not present in ${this.datasetDir}. Feature extraction will use model scores and graph topology.`);
    }
    return true;
  }

  /**
   * Ingests classes file.
   * Maps '1' -> 'illicit', '2' -> 'licit', 'unknown' -> 'unknown'
   */
  async ingestClasses() {
    const nodeMap = new Map(); // txId -> { label, timeStep, featureOffset }
    const fileStream = createReadStream(this.classesPath, { encoding: 'utf8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let isHeader = true;
    let lineNum = 0;
    for await (const line of rl) {
      lineNum++;
      if (!line.trim()) continue;
      if (isHeader) {
        isHeader = false;
        continue;
      }
      const parts = line.split(',');
      if (parts.length < 2) {
        this.stats.validationErrors.push(`Malformed class line ${lineNum}: ${line}`);
        continue;
      }
      const txId = parts[0].trim();
      const rawClass = parts[1].trim();

      // Label mapping according to Elliptic research benchmark:
      // In CSV: 1 = illicit (4,545), 2 = licit (42,019), unknown = unknown (157,205)
      let label = 'unknown';
      if (rawClass === '1') {
        label = 'illicit';
        this.stats.classes.illicit++;
      } else if (rawClass === '2') {
        label = 'licit';
        this.stats.classes.licit++;
      } else {
        label = 'unknown';
        this.stats.classes.unknown++;
      }

      if (nodeMap.has(txId)) {
        this.stats.validationErrors.push(`Duplicate transaction ID in classes: ${txId}`);
      } else {
        nodeMap.set(txId, {
          txId,
          label,
          rawClass,
          timeStep: null,
          inDegree: 0,
          outDegree: 0,
          riskScore: label === 'illicit' ? 95 : label === 'licit' ? 15 : 50,
          predictedClass: label === 'illicit' ? 'illicit' : 'licit',
          probability: label === 'illicit' ? 0.95 : label === 'licit' ? 0.15 : 0.50
        });
      }
    }

    this.stats.totalNodes = nodeMap.size;
    return nodeMap;
  }

  /**
   * Ingests edges file and constructs forward and reverse adjacency.
   */
  async ingestEdges(nodeMap) {
    const adjacency = new Map(); // txId -> Array<targetTxId>
    const reverseAdjacency = new Map(); // txId -> Array<sourceTxId>
    const edgeSet = new Set();

    const fileStream = createReadStream(this.edgesPath, { encoding: 'utf8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let isHeader = true;
    let lineNum = 0;
    let validEdges = 0;

    for await (const line of rl) {
      lineNum++;
      if (!line.trim()) continue;
      if (isHeader) {
        isHeader = false;
        continue;
      }
      const parts = line.split(',');
      if (parts.length < 2) {
        this.stats.validationErrors.push(`Malformed edge line ${lineNum}: ${line}`);
        continue;
      }
      const source = parts[0].trim();
      const target = parts[1].trim();

      const edgeKey = `${source}->${target}`;
      if (edgeSet.has(edgeKey)) {
        this.stats.duplicateEdges++;
        continue;
      }
      edgeSet.add(edgeKey);

      // Validate source and target exist in nodeMap
      const sourceNode = nodeMap.get(source);
      const targetNode = nodeMap.get(target);

      if (!sourceNode || !targetNode) {
        this.stats.missingNodesInEdges++;
      }

      if (sourceNode) sourceNode.outDegree++;
      if (targetNode) targetNode.inDegree++;

      // Forward adjacency
      let forwardList = adjacency.get(source);
      if (!forwardList) {
        forwardList = [];
        adjacency.set(source, forwardList);
      }
      forwardList.push(target);

      // Reverse adjacency
      let revList = reverseAdjacency.get(target);
      if (!revList) {
        revList = [];
        reverseAdjacency.set(target, revList);
      }
      revList.push(source);

      validEdges++;
    }

    this.stats.totalEdges = validEdges;
    return { adjacency, reverseAdjacency };
  }

  /**
   * Ingests time steps and indexes feature byte offsets for fast random lookup.
   */
  async indexFeatures(nodeMap) {
    if (!existsSync(this.featuresPath)) {
      // In serverless deployment where the 658MB features file is omitted,
      // extract time steps from model_scores.json [ timeStep, label, pred, prob, score ]
      if (existsSync(this.scoresPath)) {
        try {
          const scores = JSON.parse(readFileSync(this.scoresPath, 'utf8'));
          const timeStepCounts = {};
          for (const [txId, data] of Object.entries(scores)) {
            const timeStep = Array.isArray(data) ? data[0] : (data.timeStep || data.time_step);
            const node = nodeMap.get(txId);
            if (node && timeStep !== undefined) {
              node.timeStep = timeStep;
            }
            if (timeStep !== undefined && timeStep !== null) {
              timeStepCounts[timeStep] = (timeStepCounts[timeStep] || 0) + 1;
            }
          }
          this.stats.timeSteps = timeStepCounts;
          return;
        } catch (err) {
          console.warn('Could not populate time steps from scores:', err.message);
        }
      }
      return;
    }

    const fileStream = createReadStream(this.featuresPath, { encoding: 'utf8' });
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let lineNum = 0;
    const timeStepCounts = {};

    for await (const line of rl) {
      lineNum++;
      if (!line.trim()) continue;
      // Get first 2 comma-separated values: txId, timestep
      const firstComma = line.indexOf(',');
      if (firstComma === -1) continue;
      const secondComma = line.indexOf(',', firstComma + 1);
      if (secondComma === -1) continue;

      const txId = line.substring(0, firstComma).trim();
      const timeStep = parseInt(line.substring(firstComma + 1, secondComma).trim(), 10);

      const node = nodeMap.get(txId);
      if (node) {
        node.timeStep = timeStep;
      }
      timeStepCounts[timeStep] = (timeStepCounts[timeStep] || 0) + 1;
    }

    this.stats.timeSteps = timeStepCounts;
  }

  /**
   * Ingest precomputed model scores if available.
   */
  applyModelScores(nodeMap) {
    if (!existsSync(this.scoresPath)) return false;
    try {
      const data = JSON.parse(readFileSync(this.scoresPath, 'utf8'));
      for (const [txId, val] of Object.entries(data)) {
        const node = nodeMap.get(txId);
        if (node) {
          node.riskScore = val[0];
          node.predictedClass = val[2];
          node.probability = val[3];
        }
      }
      return true;
    } catch (err) {
      this.stats.validationErrors.push(`Failed loading model scores: ${err.message}`);
      return false;
    }
  }

  /**
   * Run full ingestion pipeline.
   */
  async execute() {
    const startTime = Date.now();
    this.validateFiles();

    const nodeMap = await this.ingestClasses();
    const { adjacency, reverseAdjacency } = await this.ingestEdges(nodeMap);
    await this.indexFeatures(nodeMap);
    this.applyModelScores(nodeMap);

    this.stats.ingestionDurationMs = Date.now() - startTime;
    this.stats.ingestedAt = new Date().toISOString();

    return {
      nodeMap,
      adjacency,
      reverseAdjacency,
      stats: this.stats
    };
  }
}

