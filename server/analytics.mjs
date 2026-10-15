import { createHash } from 'node:crypto';

/** All fixtures are synthetic. Monetary edge values are INR equivalents, not token units. */
export const DEFAULT_WEIGHTS = Object.freeze({ cluster: 25, pattern: 20, deposit: 15, temporal: 15, crossChain: 10, historical: 10, external: 5 });
const SOURCE = 'SIMULATED INVESTIGATION DATA';
const KNOWN_RELATED = new Set(['CR-2026-00192', 'CR-2026-00193', 'CR-2026-00194', 'CR-2026-00196']);
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const round = (value, places = 2) => Number(Number(value).toFixed(places));
const unique = values => [...new Set(values)];
const sum = values => values.reduce((total, value) => total + value, 0);
const clamp = value => Math.max(0, Math.min(100, value));
const iso = (hour, minute, second = 0) => `2026-09-23T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`;

export function syntheticAddress(seed, chain) {
  const digest = hash(seed);
  if (chain === 'TRON' || chain === 'Bitcoin') {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const payload = Buffer.concat([Buffer.from([chain === 'TRON' ? 0x41 : 0x00]), Buffer.from(digest.slice(0, 40), 'hex')]);
    const checksum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4);
    const bytes = Buffer.concat([payload, checksum]);
    let value = BigInt(`0x${bytes.toString('hex')}`), encoded = '';
    while (value > 0n) { encoded = alphabet[Number(value % 58n)] + encoded; value /= 58n; }
    for (const byte of bytes) { if (byte !== 0) break; encoded = `1${encoded}`; }
    return encoded;
  }
  return `0x${digest.slice(0, 40)}`;
}

function node(caseRecord, index, label, type, chain, x, y, cluster = '') {
  const shared = cluster === 'C-14';
  return {
    id: `W-${String(index + 1).padStart(2, '0')}`,
    address: index === 0 ? caseRecord.reportedWallet : syntheticAddress(shared ? `shared-C-14-${chain}` : `${caseRecord.id}:${index}`, chain),
    label, type, chain, x, y, cluster, balance: 0, riskScore: 0,
    entity: type === 'vasp' ? (caseRecord.chain === 'TRON' ? 'VASP-Y' : 'VASP-X') : type === 'bridge' ? 'DemoBridge' : type === 'dex' ? 'DemoSwap' : type === 'mixer' ? 'Synthetic privacy service' : null,
    firstSeen: null, lastSeen: null, incomingCount: 0, outgoingCount: 0,
    behavior: [], evidenceIds: [], source: SOURCE,
  };
}

/** Refresh observations after ingestion. Cross-chain pairing requires an explicit bridge edge. */
export function refreshDatasetMetrics(caseRecord, dataset) {
  const {nodes, edges} = dataset;
  for (const wallet of nodes) {
    const incoming = edges.filter(edge => edge.target === wallet.id);
    const outgoing = edges.filter(edge => edge.source === wallet.id);
    const times = [...incoming, ...outgoing].map(edge => edge.timestamp).sort();
    wallet.balance = round((wallet.id === nodes[0]?.id && wallet.type === 'victim' ? Number(caseRecord.victimLoss) : 0) + sum(incoming.map(edge => edge.amount)) - sum(outgoing.map(edge => edge.amount)));
    wallet.firstSeen = times[0] || null;
    wallet.lastSeen = times.at(-1) || null;
    wallet.incomingCount = incoming.length;
    wallet.outgoingCount = outgoing.length;
    wallet.behavior = [
      ...(incoming.length >= 3 ? ['Repeated inbound transfers'] : []),
      ...(unique(outgoing.map(edge => edge.target)).length >= 3 ? ['Fan-out distribution'] : []),
      ...(unique(incoming.map(edge => edge.source)).length >= 2 ? ['Fund consolidation'] : []),
      ...(incoming.length && outgoing.length && Date.parse(wallet.lastSeen) - Date.parse(wallet.firstSeen) < 3600000 ? ['Forwarding within one hour'] : []),
      ...(wallet.type === 'bridge' && outgoing.some(edge => nodes.find(target => target.id === edge.target)?.chain !== wallet.chain) ? ['Synthetic paired cross-chain transfer'] : []),
      ...(wallet.type === 'vasp' && incoming.length ? ['Deposit-like terminal receipts', 'Synthetic attribution registry match'] : []),
      ...(wallet.type === 'mixer' && incoming.length ? ['Privacy-enhancing service exposure; downstream identity unknown'] : []),
      ...(!incoming.length && !outgoing.length ? ['No transactions observed in this dataset'] : []),
    ];
    wallet.riskScore = !incoming.length && !outgoing.length ? 0 : wallet.type === 'victim' ? 12 : clamp(22 + wallet.behavior.length * 12 + (wallet.type === 'suspect' ? 36 : 0) + (wallet.type === 'mixer' ? 40 : 0));
  }
  const existingTransfers = dataset.crossChain || [];
  dataset.crossChain = edges.filter(edge => {
    const source = nodes.find(wallet => wallet.id === edge.source), target = nodes.find(wallet => wallet.id === edge.target);
    return source && target && source.type === 'bridge' && source.chain !== target.chain;
  }).map((edge, index) => {
    const from = nodes.find(wallet => wallet.id === edge.source) || {};
    const to = nodes.find(wallet => wallet.id === edge.target) || {};
    const existing = existingTransfers.find(transfer => transfer.transactionId === edge.id || transfer.transactionHash === edge.hash);
    return { ...existing, id: existing?.id || `BR-${String(index + 1).padStart(3, '0')}`, bridge: existing?.bridge || from.entity || 'DemoBridge', sourceChain: from.chain || 'Ethereum', destinationChain: to.chain || 'Polygon', amount: edge.amount, timestamp: edge.timestamp, transactionHash: edge.hash, sourceWallet: from.address || '', destinationWallet: to.address || '', evidenceId: 'EV-crossChain', transactionId: edge.id, confidence: existing?.confidence ?? 94, method: existing?.method || 'Explicit synthetic cross-chain edge from a bridge wallet; not live bridge inference' };
  });
  return dataset;
}

function finalize(caseRecord, nodes, definitions) {
  const edges = definitions.map(([from, to, amount, hour, minute, second = 0], index) => ({
    id: `TX-${String(index + 1).padStart(3, '0')}`,
    source: nodes[from]?.id || `W-${from}`, target: nodes[to]?.id || `W-${to}`, amount: round(amount),
    timestamp: iso(hour, minute, second), hash: `0x${hash(`${caseRecord.id}:tx:${index}`)}`,
    chain: nodes[from]?.chain || caseRecord.chain || 'Ethereum', asset: 'DEMO-INR equivalent', highlighted: ![14, 15, 16, 17].includes(to),
    sourceMode: SOURCE,
  }));
  const {crossChain} = refreshDatasetMetrics(caseRecord, {nodes, edges, crossChain: []});
  const first = edges[0] || { timestamp: iso(14, 21), id: 'TX-001' };
  const consolidation = nodes.find(wallet => wallet.cluster === 'C-14') || nodes.find(wallet => wallet.type === 'intermediary');
  const bridge = nodes.find(wallet => wallet.type === 'bridge');
  const vaspTransfers = edges.filter(edge => nodes.find(wallet => wallet.id === edge.target)?.type === 'vasp');
  const timeline = [
    { id: 'EVENT-01', timestamp: first.timestamp, action: 'Victim transfer detected', description: 'Synthetic complaint-linked transfer recorded.', evidenceIds: [first.id] },
    { id: 'EVENT-02', timestamp: consolidation?.firstSeen || iso(14, 24), action: 'Funds consolidated', description: 'Repeated intermediary receipts linked in the transaction graph.', evidenceIds: consolidation ? edges.filter(edge => edge.target === consolidation.id).map(edge => edge.id) : [] },
    { id: 'EVENT-03', timestamp: iso(14, 32), action: 'Intermediary wallet detected', description: 'Forwarding behavior identified from transaction timestamps.', evidenceIds: edges.filter(edge => nodes.find(wallet => wallet.id === edge.source)?.type === 'intermediary').slice(0, 3).map(edge => edge.id) },
    ...(bridge && crossChain.length ? [
      { id: 'EVENT-04', timestamp: bridge.firstSeen || crossChain[0].timestamp, action: 'Bridge interaction detected', description: 'Fixture contains a paired bridge deposit and destination transfer.', evidenceIds: ['EV-crossChain'] },
      { id: 'EVENT-05', timestamp: crossChain[0].timestamp, action: 'Cross-chain wallet identified', description: `${crossChain[0].sourceChain} to ${crossChain[0].destinationChain} synthetic transfer paired.`, evidenceIds: ['EV-crossChain'] },
    ] : []),
    ...(vaspTransfers.length ? [{ id: 'EVENT-06', timestamp: vaspTransfers.at(-1).timestamp, action: 'VASP candidate identified', description: 'Confidence-ranked candidate from synthetic registry and observed flow evidence.', evidenceIds: ['EV-cluster', 'EV-deposit'] }] : []),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { nodes, edges, crossChain, timeline };
}

/** A conservation-preserving trace: one victim input, seven exit receipts, no duplicated bridge value. */
function crossChainFixture(caseRecord) {
  const eth = caseRecord.chain || 'Ethereum';
  const targetChain = eth === 'Polygon' ? 'Ethereum' : 'Polygon';
  const sharedCluster = KNOWN_RELATED.has(caseRecord.id) ? 'C-14' : `C-${hash(caseRecord.id).slice(0, 6)}`;
  const specs = [
    ['Reported wallet', 'victim', eth, 20, 230, ''],
    ['Suspect wallet', 'suspect', eth, 120, 230, ''],
    ['Burner A', 'intermediary', eth, 230, 120, ''],
    ['Burner B', 'intermediary', eth, 230, 230, ''],
    ['Burner C', 'intermediary', eth, 230, 340, ''],
    ['Shared intermediary', 'intermediary', eth, 340, 230, sharedCluster],
    ['DemoBridge', 'bridge', eth, 450, 230, 'BRIDGE-01'],
    [`${targetChain} recipient`, 'intermediary', targetChain, 560, 230, ''],
    ['Forwarding A', 'intermediary', targetChain, 665, 155, ''],
    ['Forwarding B', 'intermediary', targetChain, 665, 305, ''],
    ['Consolidation', 'intermediary', targetChain, 780, 230, 'C-X-FEEDER'],
    ['VASP-X deposit A', 'vasp', targetChain, 980, 95, 'C-X'],
    ['VASP-X deposit B', 'vasp', targetChain, 980, 230, 'C-X'],
    ['VASP-X deposit C', 'vasp', targetChain, 980, 365, 'C-X'],
    ['Residual funds', 'unknown', eth, 235, 450, ''],
    ['DemoSwap', 'dex', eth, 340, 70, 'DEX-01'],
    ['Unattributed remainder', 'unknown', targetChain, 780, 440, ''],
    ['Residual treasury', 'unknown', eth, 450, 440, ''],
  ];
  const nodes = specs.map((spec, index) => node(caseRecord, index, ...spec));
  const template = [
    [0,1,812450,14,21,0],
    [1,2,300000,14,22,0],[1,3,250000,14,22,30],[1,4,200000,14,23,0],[1,14,62450,14,23,30],
    [2,5,120000,14,24,0],[2,5,130000,14,24,30],[2,15,50000,14,25,0],
    [3,5,100000,14,25,30],[3,5,120000,14,26,0],[3,14,30000,14,26,30],
    [4,5,95000,14,27,0],[4,5,100000,14,27,30],[4,17,5000,14,28,0],
    [14,17,35000,14,28,30],[14,17,25000,14,29,0],[14,17,12450,14,29,30],[14,15,10000,14,30,0],
    [15,17,8000,14,30,30],[15,17,10000,14,31,0],[15,17,17000,14,31,30],[15,17,15000,14,32,0],[15,17,10000,14,32,30],
    [5,6,250000,14,41,0],[5,6,200000,14,41,15],[5,6,200000,14,41,30],[5,17,15000,14,42,0],
    [6,7,650000,14,47,0],
    [7,8,200000,14,48,0],[7,8,150000,14,48,30],[7,9,150000,14,49,0],[7,9,150000,14,49,30],
    [8,10,170000,14,50,0],[8,10,90000,14,50,30],[8,10,85000,14,51,0],[8,16,5000,14,51,30],
    [9,10,120000,14,52,0],[9,10,100000,14,52,30],[9,10,77000,14,53,0],[9,16,3000,14,53,30],
    [10,11,100000,14,57,0],[10,11,92000,14,58,0],[10,12,110000,14,59,0],[10,12,98000,15,0,0],[10,13,80000,15,1,0],[10,13,87000,15,2,0],[10,13,75000,15,4,11],
  ];
  // Scale terminal amounts as a flow network; integer paise eliminate cumulative rounding deficits.
  const scale = Number(caseRecord.victimLoss) / 812450;
  const definitions = template.map(row => [row[0], row[1], round(row[2] * scale), ...row.slice(3)]);
  // Reconcile rounding locally while preserving topology and nonnegative balances.
  for (let source = 0; source < nodes.length; source++) {
    const incoming = sum(definitions.filter(row => row[1] === source).map(row => row[2]));
    const outgoing = definitions.filter(row => row[0] === source);
    const available = source === 0 ? Number(caseRecord.victimLoss) : incoming;
    const total = sum(outgoing.map(row => row[2]));
    if (outgoing.length && total > available) outgoing[outgoing.length - 1][2] = round(outgoing.at(-1)[2] - (total - available));
  }
  return finalize(caseRecord, nodes, definitions);
}

function singleChainFixture(caseRecord, privacy = false) {
  const chain = caseRecord.chain;
  const vasp = chain === 'TRON' ? 'VASP-Y' : 'VASP-X';
  const sharedCluster = KNOWN_RELATED.has(caseRecord.id) ? 'C-14' : `C-${hash(caseRecord.id).slice(0, 6)}`;
  const specs = [
    ['Reported wallet','victim',chain,20,240,''], ['Suspect wallet','suspect',chain,180,240,''],
    ['Forwarding A','intermediary',chain,350,120,''], ['Forwarding B','intermediary',chain,350,340,''],
    ['Shared intermediary','intermediary',chain,530,240,sharedCluster],
    [privacy ? 'Privacy exposure' : `${vasp} deposit A`,privacy ? 'mixer' : 'vasp',chain,745,140,privacy ? 'PRIVACY-01' : `C-${vasp}`],
    [privacy ? 'Unattributed remainder' : `${vasp} deposit B`,privacy ? 'unknown' : 'vasp',chain,745,330,privacy ? '' : `C-${vasp}`],
    ['Residual funds','unknown',chain,530,440,''],
  ];
  const nodes = specs.map((spec,index) => node(caseRecord,index,...spec));
  const amount = Number(caseRecord.victimLoss);
  const unit = ratio => Math.floor(amount * ratio * 100) / 100;
  const a = unit(.55), b = round(amount-a), aOut = unit(.5), bOut = unit(.42), combined = round(aOut+bOut);
  const definitions = [
    [0,1,amount,14,21],[1,2,a,14,22],[1,3,b,14,23],
    [2,4,unit(.25),14,24],[2,4,round(aOut-unit(.25)),14,25],
    [3,4,unit(.21),14,26],[3,4,round(bOut-unit(.21)),14,27],
    [2,7,round(a-aOut),14,28],[3,7,round(b-bOut),14,29],
    [4,5,unit(.22),14,32],[4,5,unit(.23),14,33],[4,5,unit(.25),14,34],
    [4,6,round(combined-unit(.70)),14,35],
  ];
  if (privacy) nodes[6].behavior = ['Tracing confidence reduced beyond privacy exposure'];
  return finalize(caseRecord,nodes,definitions);
}

export function buildDataset(caseRecord) {
  if (!caseRecord || !caseRecord.id || !Number.isFinite(Number(caseRecord.victimLoss)) || Number(caseRecord.victimLoss) <= 0) throw new TypeError('A case ID and a positive victim loss are required.');
  if (/ransomware|darknet/i.test(caseRecord.fraudType)) return singleChainFixture(caseRecord,true);
  if (['Ethereum','Polygon'].includes(caseRecord.chain)) return crossChainFixture(caseRecord);
  return singleChainFixture(caseRecord,false);
}

export function shortestPath(dataset, fromId, toId) {
  if (!fromId || !toId || !dataset?.edges) return [];
  const queue = [[fromId]];
  const visited = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === toId) return path;
    for (const edge of (dataset.edges || []).filter(item => item.source === current)) if (!visited.has(edge.target)) {
      visited.add(edge.target); queue.push([...path, edge.target]);
    }
  }
  return [];
}

function behavioralFeatures(dataset) {
  const nodes = dataset.nodes || [];
  const edges = dataset.edges || [];
  const crossChain = dataset.crossChain || [];
  const first = edges.length ? Math.min(...edges.map(edge => Date.parse(edge.timestamp) || Date.now())) : Date.now();
  const last = edges.length ? Math.max(...edges.map(edge => Date.parse(edge.timestamp) || Date.now())) : Date.now();
  const durationHours = Math.max((last - first) / 3600000, 1 / 60);
  const holding = nodes.filter(wallet => wallet.incomingCount && wallet.outgoingCount).map(wallet => {
    const incoming = edges.filter(edge => edge.target === wallet.id);
    const outgoing = edges.filter(edge => edge.source === wallet.id);
    const minOut = outgoing.length ? Math.min(...outgoing.map(edge => Date.parse(edge.timestamp) || 0)) : 0;
    const minIn = incoming.length ? Math.min(...incoming.map(edge => Date.parse(edge.timestamp) || 0)) : 0;
    return Math.max(0, (minOut - minIn) / 60000);
  });
  const degree = nodes.map(wallet => ({wallet, incoming: unique(edges.filter(edge => edge.target === wallet.id).map(edge => edge.source)).length, outgoing: unique(edges.filter(edge => edge.source === wallet.id).map(edge => edge.target)).length}));
  const forwarding = nodes.filter(wallet => wallet.incomingCount && wallet.outgoingCount);
  const terminalReceipts = edges.filter(edge => nodes.find(wallet => wallet.id === edge.target)?.type === 'vasp');
  return {
    transactionCount: edges.length,
    uniqueCounterparties: Math.max(0, nodes.length - 1),
    averageTransactionValue: edges.length ? round(sum(edges.map(edge => edge.amount)) / edges.length) : 0,
    transactionVelocity: round(edges.length / durationHours),
    walletAge: round(durationHours / 24, 4),
    averageHoldingTime: holding.length ? round(sum(holding) / Math.max(holding.length, 1)) : 0,
    fanInRatio: degree.length ? round(Math.max(0, ...degree.map(item => item.incoming))) : 0,
    fanOutRatio: degree.length ? round(Math.max(0, ...degree.map(item => item.outgoing))) : 0,
    consolidationBehavior: degree.filter(item => item.incoming >= 2).length,
    dispersionBehavior: degree.filter(item => item.outgoing >= 2).length,
    bridgeUsage: nodes.filter(wallet => wallet.type === 'bridge').length,
    dexUsage: nodes.filter(wallet => wallet.type === 'dex').length,
    mixerExposure: nodes.filter(wallet => wallet.type === 'mixer').length,
    crossChainMovement: crossChain.length,
    stablecoinConcentration: 0,
    vaspInteraction: terminalReceipts.length,
    incomingVolume: nodes[0] ? round(sum(edges.filter(edge => edge.source === nodes[0].id).map(edge => edge.amount))) : 0,
    outgoingVolume: round(sum(terminalReceipts.map(edge => edge.amount))),
    forwardingWallets: forwarding.length,
    observedDurationMinutes: round(durationHours * 60),
    assetCoverage: 0,
  };
}

function makeEvidence(id,title,description,weight,score,edges,nodes) {
  return {id:`EV-${id}`,title,description,weight,score,contribution:round(weight*score/100,2),transactionIds:unique((edges||[]).map(edge=>edge?.id).filter(Boolean)),walletIds:unique((nodes||[]).map(wallet=>wallet?.id).filter(Boolean))};
}

export function analyzeDataset(caseRecord,dataset,weights=DEFAULT_WEIGHTS) {
  refreshDatasetMetrics(caseRecord,dataset);
  const {nodes = [], edges = [], crossChain = []} = dataset;
  if (Object.keys(DEFAULT_WEIGHTS).some(key=>!Number.isFinite(weights[key])||weights[key]<0) || Math.abs(sum(Object.values(weights))-100)>.001) throw new TypeError('Attribution weights must contain the seven nonnegative evidence weights and sum to 100.');
  const features=behavioralFeatures(dataset);
  const vaspNodes=nodes.filter(wallet=>wallet.type==='vasp');
  const exitEdges=edges.filter(edge=>vaspNodes.some(wallet=>wallet.id===edge.target));
  const forwardingNodes=nodes.filter(wallet=>wallet.incomingCount&&wallet.outgoingCount);
  const forwardingEdges=edges.filter(edge=>forwardingNodes.some(wallet=>wallet.id===edge.source));
  const rapid=features.averageHoldingTime>0 && features.averageHoldingTime<60;
  const scores={
    cluster:clamp(70+Math.min(26,vaspNodes.length*9)),pattern:50+Math.min(40,forwardingEdges.length*2),
    deposit:45+Math.min(49,exitEdges.length*7),temporal:rapid?88:48,crossChain:crossChain.length?94:35,
    historical:30+Math.min(56,edges.length*2),external:74,
  };
  const evidence=vaspNodes.length?[
    makeEvidence('cluster','Address cluster relationship',`${vaspNodes.length} terminal deposit wallets share a synthetic VASP cluster tag. Score = 70 + min(26, 9 × deposit wallets); cluster labels are fixture metadata, not independently verified ownership.`,weights.cluster,scores.cluster,exitEdges,vaspNodes),
    makeEvidence('pattern','Repeated forwarding pattern',`${forwardingEdges.length} transactions originate from wallets with both receipts and payments. Score = 50 + min(40, 2 × forwarding transactions).`,weights.pattern,scores.pattern,forwardingEdges,forwardingNodes),
    makeEvidence('deposit','Deposit-like transaction behavior',`${exitEdges.length} terminal receipts arrive at candidate cluster wallets. Score = 45 + min(49, 7 × receipts). This behavior alone does not establish exchange ownership.`,weights.deposit,scores.deposit,exitEdges,vaspNodes),
    makeEvidence('temporal','Temporal correlation',`Mean observed intermediary holding time is ${features.averageHoldingTime} minutes. The deterministic rule scores 88 below 60 minutes and 48 otherwise.`,weights.temporal,scores.temporal,forwardingEdges,forwardingNodes),
    makeEvidence('crossChain','Cross-chain convergence',crossChain.length?`${crossChain.length} bridge transfer is explicitly paired in this synthetic fixture. Pairing scores 94; this is not independent live-chain validation.`:'No cross-chain pairing is available; a limited neutral score of 35 is assigned.',weights.crossChain,scores.crossChain,edges.filter(edge=>crossChain.some(transfer=>transfer.transactionHash===edge.hash)),nodes.filter(wallet=>wallet.type==='bridge'||crossChain.some(transfer=>transfer.destinationWallet===wallet.address))),
    makeEvidence('historical','Repeated observed interaction',`${edges.length} transactions support this observed flow. Score = 30 + min(56, 2 × observed transactions); no history outside this dataset is implied.`,weights.historical,scores.historical,edges,forwardingNodes),
    makeEvidence('external','Synthetic knowledge-base tag','The fictional VASP registry supplies a demonstration-only reliability score of 74. No commercial attribution provider or government system is connected.',weights.external,scores.external,exitEdges,vaspNodes),
  ]:[];
  const confidence=vaspNodes.length?Math.round(sum(evidence.map(item=>item.contribution))):0;
  const tracedAmount=round(sum(exitEdges.map(edge=>edge.amount)));
  const candidate=vaspNodes[0]?.entity||null;
  const exitTimestamps = exitEdges.map(edge => edge.timestamp).filter(Boolean).sort();
  const attributions=vaspNodes.length?[{
    id:`ATTR-${caseRecord.id}`,candidate,confidence,tracedAmount,transactionCount:exitEdges.length,chains:unique(nodes.map(wallet=>wallet.chain)),
    firstInteraction:exitTimestamps[0] || null,lastInteraction:exitTimestamps.at(-1) || null,
    hops:nodes[0] && vaspNodes[0] ? Math.max(0,shortestPath(dataset,nodes[0].id,vaspNodes[0].id).length-1) : 0,evidence,
  }]:[];
  const indicators=[];
  if (rapid) indicators.push(makeEvidence('risk-velocity','Rapid fund forwarding',`Observed average holding time ${features.averageHoldingTime} minutes; ${features.transactionVelocity} transactions/hour in this bounded fixture.`,18,100,forwardingEdges,forwardingNodes));
  if (features.incomingVolume>=100000 && edges[0] && nodes[0]) indicators.push(makeEvidence('risk-value','Large reported movement','The complaint-linked initial transfer exceeds the demo review threshold of ₹1 lakh.',15,100,[edges[0]],[nodes[0],nodes[1]].filter(Boolean)));
  if (crossChain.length) indicators.push(makeEvidence('risk-crossChain','Cross-chain transfer',`${crossChain.length} explicitly paired synthetic bridge transfer connects two chains.`,16,100,edges.filter(edge=>crossChain.some(transfer=>transfer.transactionHash===edge.hash)),nodes.filter(wallet=>wallet.type==='bridge')));
  if (features.dispersionBehavior>=2) indicators.push(makeEvidence('risk-dispersion','Multi-wallet dispersion',`${features.dispersionBehavior} wallets send funds to multiple distinct counterparties.`,10,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.source&&wallet.outgoingCount>=2)),forwardingNodes));
  if (features.consolidationBehavior) indicators.push(makeEvidence('risk-consolidation','Fund consolidation',`${features.consolidationBehavior} wallets receive from at least two distinct sources.`,14,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.target&&wallet.incomingCount>=2)),nodes.filter(wallet=>wallet.incomingCount>=2)));
  if (features.mixerExposure) indicators.push(makeEvidence('risk-privacy','Privacy-enhancing service exposure','Privacy-service interaction reduces tracing confidence. This system does not deanonymize the service or infer downstream ownership.',25,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.target&&wallet.type==='mixer')),nodes.filter(wallet=>wallet.type==='mixer')));
  const riskScore=Math.min(99,10+sum(indicators.map(item=>item.weight)));
  const rawPatterns=[
    {name:'Investment Scam Pattern',value:20+(features.consolidationBehavior?25:0)+(features.vaspInteraction?25:0)+(features.crossChainMovement?30:0),reason:'Consolidation, candidate service deposits and cross-chain movement match a synthetic investment-flow profile.',evidenceIds:['EV-risk-consolidation',...(crossChain.length?['EV-risk-crossChain']:[]),...(vaspNodes.length?['EV-deposit']:[])]},
    {name:'Task Scam Pattern',value:20+(rapid?20:0)+(features.dispersionBehavior>=2?15:0)+(features.crossChainMovement?0:25),reason:'Short holding times and repeated forwarding match a synthetic task-payment dispersal profile.',evidenceIds:['EV-risk-velocity','EV-risk-dispersion']},
    {name:'General Laundering Pattern',value:20+(features.mixerExposure?65:0)+(features.bridgeUsage?15:0)+(features.dispersionBehavior?15:0),reason:'Dispersion, bridge use or privacy exposure match a synthetic layering profile; these behaviors also have legitimate uses.',evidenceIds:indicators.filter(item=>/privacy|dispersion|crossChain/.test(item.id)).map(item=>item.id)},
  ];
  // Softmax yields a normalized comparative profile, not calibrated crime probabilities.
  const exp=rawPatterns.map(pattern=>Math.exp(pattern.value/22));
  const expSum = sum(exp) || 1;
  const patterns=rawPatterns.map((pattern,index)=>({name:pattern.name,score:round(exp[index]/expSum*100,1),reason:`Pattern consistent with this rule-based profile. ${pattern.reason} Scores are relative similarities, not probabilities or proof of crime.`,evidenceIds:pattern.evidenceIds.filter(id=>[...evidence,...indicators].some(item=>item.id===id))})).sort((a,b)=>b.score-a.score);
  if (patterns[0]) patterns[0].score=round(patterns[0].score+100-sum(patterns.map(pattern=>pattern.score)),1);
  const recommendations=[
    'Preserve the transaction hashes, timestamps and synthetic data-source labels in the evidence package.',
    'Review intermediary wallets and validate all candidate cluster associations against independently obtained records.',
    ...(candidate?[`Prepare an authorized information-request package for candidate ${candidate}; do not infer ownership or KYC from this prototype.`]:['No defensible VASP candidate is present in this dataset. Continue monitoring observable downstream exits.']),
    ...(features.mixerExposure?['Privacy-enhancing service exposure reduces tracing confidence. Do not assume the identity of downstream recipients.']:[]),
    'Review related complaints and corroborate shared-wallet or cluster evidence.',
    'Obtain appropriate human and legal verification before investigative action.',
  ];
  const knowledgeNodes=[
    {id:`case:${caseRecord.id}`,label:caseRecord.id,type:'Case'},
    ...nodes.map(wallet=>({id:`wallet:${wallet.id}`,label:wallet.label,type:'Wallet',address:wallet.address})),
    ...unique(nodes.filter(wallet=>wallet.cluster).map(wallet=>wallet.cluster)).map(cluster=>({id:`cluster:${cluster}`,label:cluster,type:'Cluster'})),
    ...unique(nodes.map(wallet=>wallet.chain)).map(chain=>({id:`chain:${chain}`,label:chain,type:'Blockchain'})),
    ...unique(vaspNodes.map(wallet=>wallet.entity)).map(entity=>({id:`vasp:${entity}`,label:entity,type:'VASP'})),
    ...evidence.map(item=>({id:`evidence:${item.id}`,label:item.title,type:'Evidence'})),
    ...patterns.map((pattern,index)=>({id:`pattern:${index}`,label:pattern.name,type:'Fraud Pattern'})),
    ...edges.map(edge=>({id:`transaction:${edge.id}`,label:edge.id,type:'Transaction'})),
    ...nodes.filter(wallet=>['bridge','dex','mixer'].includes(wallet.type)).map(wallet=>({id:`service:${wallet.id}`,label:wallet.entity,type:wallet.type==='bridge'?'Bridge':wallet.type==='dex'?'DEX':'Mixer'})),
  ];
  const knowledgeEdges=[
    ...nodes.map(wallet=>({source:`wallet:${wallet.id}`,target:`case:${caseRecord.id}`,type:'INVOLVED_IN',label:'INVOLVED_IN'})),
    ...nodes.filter(wallet=>wallet.cluster).map(wallet=>wallet.cluster?{source:`wallet:${wallet.id}`,target:`cluster:${wallet.cluster}`,type:'BELONGS_TO',label:'BELONGS_TO'}:null).filter(Boolean),
    ...vaspNodes.map(wallet=>wallet.cluster&&wallet.entity?{source:`cluster:${wallet.cluster}`,target:`vasp:${wallet.entity}`,type:'ASSOCIATED_WITH',label:'ASSOCIATED_WITH'}:null).filter(Boolean),
    ...nodes.map(wallet=>({source:`wallet:${wallet.id}`,target:`chain:${wallet.chain}`,type:'ON_CHAIN',label:'ON_CHAIN'})),
    ...edges.flatMap(edge=>[
      {source:`wallet:${edge.source}`,target:`wallet:${edge.target}`,type:'INTERACTS_WITH',label:'INTERACTS_WITH'},
      {source:`transaction:${edge.id}`,target:`wallet:${edge.source}`,type:'CONNECTS',label:'CONNECTS'},
      {source:`transaction:${edge.id}`,target:`wallet:${edge.target}`,type:'CONNECTS',label:'CONNECTS'},
    ]),
    ...(candidate?evidence.map(item=>({source:`evidence:${item.id}`,target:`vasp:${candidate}`,type:'SUPPORTS',label:'SUPPORTS'})):[]),
    ...patterns.map((pattern,index)=>({source:`case:${caseRecord.id}`,target:`pattern:${index}`,type:'CONSISTENT_WITH',label:'CONSISTENT_WITH'})),
    ...nodes.filter(wallet=>['bridge','dex','mixer'].includes(wallet.type)).flatMap(wallet=>edges.filter(edge=>edge.target===wallet.id).map(edge=>({source:`wallet:${edge.source}`,target:`service:${wallet.id}`,type:wallet.type==='bridge'?'USED':wallet.type==='dex'?'INTERACTS_WITH':'EXPOSED_TO',label:wallet.type==='bridge'?'USED':wallet.type==='dex'?'INTERACTS_WITH':'EXPOSED_TO'}))),
  ].map((edge,index)=>({id:`KG-${index+1}`,...edge}));
  for (const wallet of nodes) wallet.evidenceIds=[...evidence,...indicators].filter(item=>item.walletIds?.includes(wallet.id)).map(item=>item.id);
  return {attributions,fingerprint:{features,patterns,method:'Deterministic behavioral rules; similarities are not calibrated probabilities. Asset composition is unavailable because transactions use synthetic INR equivalents.',version:'1.0'},riskIndicators:indicators,recommendations,knowledgeGraph:{nodes:knowledgeNodes,edges:knowledgeEdges},riskScore,tracedAmount,confidence,vaspCandidate:candidate};
}

export function correlateCases(caseRecord,allInvestigations) {
  if (!caseRecord || !Array.isArray(allInvestigations)) return [];
  const current=allInvestigations.find(investigation=>investigation?.case?.id===caseRecord.id);
  if (!current || !current.nodes) return [];
  const tagged=current.nodes.filter(wallet=>wallet.cluster==='C-14');
  return allInvestigations.filter(investigation=>investigation?.case?.id&&investigation.case.id!==caseRecord.id).flatMap(other=>{
    if (!other || !other.nodes) return [];
    const shared=other.nodes.find(wallet=>wallet.cluster==='C-14'&&tagged.length);
    const sameWallet=shared&&tagged.find(wallet=>wallet.chain===shared.chain&&wallet.address===shared.address);
    if (!shared) return [];
    const sameVasp=current.attributions?.[0]?.candidate&&current.attributions[0].candidate===other.attributions?.[0]?.candidate;
    return [{caseId:other.case.id,fraudType:other.case.fraudType,relationship:sameWallet?'Shared intermediary wallet and cluster':'Shared synthetic intermediary cluster across chains',sharedWallet:sameWallet?shared.address:null,sharedCluster:'C-14',sharedVasp:sameVasp?current.attributions[0].candidate:null,confidence:sameWallet?94:78,evidence:'Synthetic cluster membership; cross-chain cluster association requires independent corroboration.'}];
  }).sort((a,b)=>b.confidence-a.confidence||a.caseId.localeCompare(b.caseId));
}
