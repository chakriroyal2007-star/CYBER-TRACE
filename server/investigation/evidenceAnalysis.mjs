import { performance } from 'node:perf_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { PriorityQueue } from '../graph/algorithms.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bad = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function validateTransfers(rows) {
  if (!Array.isArray(rows) || rows.length > 5000) bad('Provide at most 5000 transaction rows.');
  const ids = new Set();
  return rows.map((r, i) => {
    if (!r || typeof r !== 'object') bad(`Invalid row ${i + 1}.`);
    const row = {};
    for (const key of ['from', 'to', 'asset', 'network', 'reference']) {
      if (typeof r[key] !== 'string' || !r[key].trim() || r[key].length > 256) bad(`Row ${i + 1}: ${key} is required (max 256 characters).`);
      row[key] = r[key].trim();
    }
    row.amount = String(r.amount ?? '');
    if (!/^\d{1,30}(\.\d{1,18})?$/.test(row.amount) || Number(row.amount) <= 0) bad(`Row ${i + 1}: positive decimal amount required.`);
    if (!Number.isFinite(Date.parse(r.timestamp))) bad(`Row ${i + 1}: timestamp required.`);
    row.timestamp = new Date(r.timestamp).toISOString();
    if(r.cost!==undefined){if(typeof r.cost!=='number' || !Number.isFinite(r.cost) || r.cost<0 || r.cost>1e12)bad(`Row ${i+1}: cost must be a non-negative finite number (max 1e12).`);row.cost=r.cost;}
    row.provenance = 'INVESTIGATOR_SUBMITTED_UNVERIFIED';
    const key = JSON.stringify([row.network, row.asset, row.reference, row.from, row.to]);
    if (ids.has(key)) bad(`Duplicate transaction row ${i + 1}.`);
    ids.add(key);
    return row;
  });
}
const keyFor = (r, address) => JSON.stringify([r.network, r.asset, address]);
export function analyzeTransfers(rows, options = {}) {
  rows = validateTransfers(rows);
  const started = performance.now(), nodes = new Map(), adjacency = new Map(), incoming = new Map();
  const edges = rows.map((r, i) => {
    const from = keyFor(r, r.from), to = keyFor(r, r.to);
    for (const [id, address] of [[from, r.from], [to, r.to]]) {
      nodes.set(id, { id, address, asset: r.asset, network: r.network });
      if (!adjacency.has(id)) { adjacency.set(id, []); incoming.set(id, []); }
    }
    const edge = { ...r, id: String(i), source: from, target: to, weight: r.cost ?? 1 };
    adjacency.get(from).push(edge); incoming.get(to).push(edge);
    return edge;
  });
  const indexExecutionMs=performance.now()-started;
  const executions = [];
  function measure(algorithm, timeComplexity, spaceComplexity, fn) {
    const t = performance.now(), result = fn();
    const entry = { algorithm, timeComplexity, spaceComplexity, executionMs: performance.now() - t, ...result };
    executions.push(entry); return entry;
  }
  measure('HashMap / HashSet', 'O(V + E) expected', 'O(V + E)', () => ({ nodesVisited: nodes.size, edgeVisits: edges.length, result: { uniqueNodes: nodes.size, uniqueTransfers: edges.length } }));
  executions[0].executionMs=indexExecutionMs;
  if(options.sources!==undefined && (!Array.isArray(options.sources) || options.sources.some(x=>typeof x!=='string')))bad('Sources must be an array of node IDs or addresses.');
  const requested = Array.isArray(options.sources) ? options.sources : [];
  const identifiers=new Set([...nodes.keys(),...[...nodes.values()].map(n=>n.address)]);
  for(const source of requested)if(!identifiers.has(source))bad(`Source not found: ${source}`);
  const requestedSet=new Set(requested);
  const sources = [...nodes.keys()].filter(id => requestedSet.has(id) || requestedSet.has(nodes.get(id).address));
  if (!sources.length && nodes.size) sources.push(nodes.keys().next().value);
  const start = sources[0];
  const matchedTarget=[...nodes.keys()].find(id => id === options.target || nodes.get(id).address === options.target);
  if(options.target && !matchedTarget)bad('Target is not present in the submitted graph.');
  const target = matchedTarget || [...nodes.keys()].at(-1);
  function breadth(seeds) {
    const queue = [...seeds], distance = new Map(seeds.map(id => [id, 0])), parents = new Map(); let visits = 0;
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head];
      for (const e of adjacency.get(id) || []) { visits++; if (!distance.has(e.target)) { distance.set(e.target, distance.get(id) + 1); parents.set(e.target, id); queue.push(e.target); } }
    }
    let path = null;
    if (distance.has(target)) { path = [target]; while (parents.has(path.at(-1))) path.push(parents.get(path.at(-1))); path.reverse(); }
    return { nodesVisited: distance.size, edgeVisits: visits, visited: queue, path, distances: Object.fromEntries(distance) };
  }
  const bfs = measure('BFS', 'O(V + E)', 'O(V)', () => breadth(start ? [start] : []));
  measure('Multi-source BFS', 'O(V + E)', 'O(V)', () => breadth(sources));
  const dfs = measure('DFS / directed cycle detection', 'O(V + E)', 'O(V)', () => {
    const colors = new Map(), visited = [], backEdges = []; let visits = 0;
    for (const seed of nodes.keys()) {
      if (colors.has(seed)) continue;
      const stack = [{ id: seed, cursor: 0 }]; colors.set(seed, 1); visited.push(seed);
      while (stack.length) {
        const frame = stack.at(-1), next = adjacency.get(frame.id);
        if (frame.cursor === next.length) { colors.set(frame.id, 2); stack.pop(); continue; }
        const e = next[frame.cursor++]; visits++;
        if (colors.get(e.target) === 1) backEdges.push(e.id);
        if (!colors.has(e.target)) { colors.set(e.target, 1); visited.push(e.target); stack.push({ id: e.target, cursor: 0 }); }
      }
    }
    return { nodesVisited: visited.length, edgeVisits: visits, visited, cycleDetected: backEdges.length > 0, backEdges };
  });
  measure('Dijkstra / Priority Queue / Binary Min-Heap', 'O((V + E) log(V + E))', 'O(V + E)', () => {
    const queue = new PriorityQueue(), distances = new Map(), parents = new Map(), visited = []; let visits = 0, pushes = 0, pops = 0;
    if (start) { queue.push({ id: start, priority: 0 }); distances.set(start, 0); pushes++; }
    while (!queue.isEmpty()) {
      const current = queue.pop(); pops++;
      if (current.priority !== distances.get(current.id)) continue;
      visited.push(current.id);
      for (const e of adjacency.get(current.id)) {
        visits++; const d = current.priority + e.weight;
        if (d < (distances.get(e.target) ?? Infinity)) { distances.set(e.target, d); parents.set(e.target, current.id); queue.push({ id: e.target, priority: d }); pushes++; }
      }
    }
    let path = null;
    if (distances.has(target)) { path = [target]; while (parents.has(path.at(-1))) path.push(parents.get(path.at(-1))); path.reverse(); }
    return { nodesVisited: visited.length, edgeVisits: visits, visited, path, distance: distances.get(target) ?? null, weightMeaning: 'Non-negative analyst-entered cost; defaults to one per transfer. A shortest-cost route is not money ownership or taint attribution.', heapPushes: pushes, heapPops: pops };
  });
  measure('Union-Find', 'O((V + E) α(V)) amortized', 'O(V)', () => {
    const parent = new Map([...nodes.keys()].map(id => [id, id])), rank = new Map();
    const find = id => { let r = id; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(id) !== id) { const next = parent.get(id); parent.set(id, r); id = next; } return r; };
    for (const e of edges) { let a = find(e.source), b = find(e.target); if (a === b) continue; if ((rank.get(a) || 0) < (rank.get(b) || 0)) [a, b] = [b, a]; parent.set(b, a); if ((rank.get(a) || 0) === (rank.get(b) || 0)) rank.set(a, (rank.get(a) || 0) + 1); }
    const groups = new Map(); for (const id of nodes.keys()) { const r = find(id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(id); }
    return { nodesVisited: nodes.size, edgeVisits: edges.length, components: [...groups.values()] };
  });
  const windowMs = options.windowMs ?? 300000;
  if (!Number.isFinite(windowMs) || windowMs <= 0 || windowMs > 86400000) bad('windowMs must be 1..86400000.');
  const temporal = measure('Sliding Window', 'O(E log E) sorting + O(E) scan', 'O(E)', () => {
    const sorted = edges.map(e => ({ id: e.id, time: Date.parse(e.timestamp) })).sort((a, b) => a.time - b.time);
    let left = 0, max = 0, best = [];
    for (let right = 0; right < sorted.length; right++) { while (sorted[right].time - sorted[left].time > windowMs) left++; if (right - left + 1 > max) { max = right - left + 1; best = [left, right]; } }
    return { nodesVisited: nodes.size, edgeVisits: edges.length, windowMs, maxTransfers: max, transferIds: best.length ? sorted.slice(best[0], best[1] + 1).map(e => e.id) : [] };
  });
  const maxFanout = Math.max(0, ...[...adjacency.values()].map(list => new Set(list.map(e => e.target)).size));
  const factors = [
    { factor: 'Multi-hop reachability (up to 20 points)', points: Math.min(20, Math.max(0, ...Object.values(bfs.distances)) * 5) },
    { factor: 'Fan-out (up to 15 points)', points: Math.min(15, Math.max(0, maxFanout - 1) * 5) },
    { factor: 'Transfers in configured time window (up to 15 points)', points: Math.min(15, Math.max(0, temporal.maxTransfers - 2) * 3) },
    { factor: 'Directed cycle (10 points)', points: dfs.cycleDetected ? 10 : 0 }
  ];
  const features={transaction:{count:edges.length,distinctReferences:new Set(rows.map(r=>r.reference)).size},graph:{nodes:nodes.size,maxFanout,maxFanin:Math.max(0,...[...incoming.values()].map(list=>new Set(list.map(e=>e.source)).size)),cycleDetected:dfs.cycleDetected,maxReachableHops:Math.max(0,...Object.values(bfs.distances))},temporal:{windowMs,maxTransfersInWindow:temporal.maxTransfers,observationSpanMs:rows.length?Math.max(...rows.map(r=>Date.parse(r.timestamp)))-Math.min(...rows.map(r=>Date.parse(r.timestamp))):null},network:{networks:[...new Set(rows.map(r=>r.network))],assets:[...new Set(rows.map(r=>r.asset))],components:executions.find(x=>x.algorithm==='Union-Find').components.length}};
  const ml = loadResearchPrediction(options.researchTxId);
  if (ml.available) factors.push({ factor: 'Research Random Forest probability × 40 (explicit dataset association)', points: ml.probability * 40 });
  const score = edges.length ? Math.round(factors.reduce((sum, f) => sum + f.points, 0)) : null;
  return { mode: 'SUBMITTED_TRANSACTION_EVIDENCE', nodes: [...nodes.values()], edges, executions, sources, target, riskScore: score, riskCategory: score === null ? 'INSUFFICIENT EVIDENCE' : score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW', features, confidence: { value: null, basis: 'Uncalibrated triage score; evidence is submitted, not independently verified.' }, factors, ml, executionMs: performance.now() - started, limitations: ['Graph paths express connectivity, not proof that the same money or person controls each hop.', 'Assets and networks are isolated; cross-asset conversion requires separate evidence.', 'No bank, UPI, wallet ownership, or account takeover is established by topology.', 'Absence of observed patterns is not evidence of safety.', ...(ml.available ? ['Research model is transductive and applies only to the explicitly associated Elliptic transaction; no validated UPI model exists.'] : ['ML unavailable for this incident; missing model input is not replaced with a prediction.'])] };
}
let cachedPredictions, cachedMtime;
export function loadResearchPrediction(txId) {
  if (!txId) return { available: false, reason: 'No explicit Elliptic research transaction associated.' };
  const path = resolve(root, 'data/ml/research_predictions.json.gz');
  if (!existsSync(path)) return { available: false, reason: 'Reproducible research training has not run.' };
  const mtime = statSync(path).mtimeMs;
  if(!cachedPredictions || mtime!==cachedMtime) { cachedPredictions=JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')); cachedMtime=mtime; }
  const artifact = cachedPredictions;
  const prediction = artifact.predictions[String(txId)];
  if (!prediction) return { available: false, reason: 'Transaction absent from trained research dataset.' };
  return { available: true, dataset: 'Elliptic', txId: String(txId), runId: artifact.runId, ...prediction, calibrated: false };
}
export function initializeEvidenceAnalysis(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS incident_transfers(case_id TEXT PRIMARY KEY REFERENCES complaints(case_id), rows_json TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incident_analysis_runs(id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES complaints(case_id), actor_id TEXT NOT NULL, created_at TEXT NOT NULL, input_sha256 TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS incident_analysis_case ON incident_analysis_runs(case_id,created_at);`);
}
export function saveAnalysis(db, caseId, actorId, options) {
  const rows = JSON.parse(db.prepare('SELECT rows_json FROM incident_transfers WHERE case_id=?').get(caseId)?.rows_json || '[]');
  const result = { ...analyzeTransfers(rows, options), id: randomUUID(), caseId, createdAt: new Date().toISOString(), inputSha256: createHash('sha256').update(JSON.stringify({ rows, options })).digest('hex') };
  db.prepare('INSERT INTO incident_analysis_runs VALUES(?,?,?,?,?,?)').run(result.id, caseId, actorId, result.createdAt, result.inputSha256, JSON.stringify(result));
  return result;
}

// Bipartite complaint/identifier traversal. Shared identifiers are leads, not proof of common ownership.
export function connectedComplaints(rows, caseId) {
  const started=performance.now(), byCase=new Map(), byIdentifier=new Map();
  for(const row of rows){
    const identifiers=[];
    if(row.reported_wallet) identifiers.push(`wallet:${row.chain}:${['Ethereum','Polygon','BNB Chain'].includes(row.chain)?row.reported_wallet.toLowerCase():row.reported_wallet}`);
    if(row.suspect_upi) identifiers.push(`upi:${row.suspect_upi.trim().toLowerCase()}`);
    if(row.suspect_phone) identifiers.push(`phone:${row.suspect_phone.replace(/\D/g,'')}`);
    byCase.set(row.case_id,identifiers);
    for(const key of identifiers){if(!byIdentifier.has(key))byIdentifier.set(key,[]);byIdentifier.get(key).push(row.case_id);}
  }
  const queue=[caseId],seen=new Set(queue),seenKeys=new Set(),links=[];
  for(let head=0;head<queue.length;head++)for(const key of byCase.get(queue[head]) || []){
    if(seenKeys.has(key))continue;seenKeys.add(key);
    for(const next of byIdentifier.get(key) || [])if(!seen.has(next)){seen.add(next);queue.push(next);links.push({caseId:next,viaCaseId:queue[head],sharedIdentifierType:key.split(':')[0]});}
  }
  return {links,nodesVisited:seen.size,identifiersVisited:seenKeys.size,executionMs:performance.now()-started,timeComplexity:'O(C + I) expected',spaceComplexity:'O(C + I)',limitation:'Shared submitted identifiers are unverified connections, not proof of a fraud network.'};
}
