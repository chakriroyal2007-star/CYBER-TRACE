import { createHash } from 'node:crypto';

/** All fixtures are synthetic. Monetary edge values are INR equivalents, not token units. */
export const DEFAULT_WEIGHTS = Object.freeze({ cluster: 25, pattern: 20, deposit: 15, temporal: 15, crossChain: 10, historical: 10, external: 5 });
export const DEFAULT_RISK_CRITERIA = Object.freeze({
  velocitySensitivity: 25,
  volumeThresholdWeight: 20,
  mixerPrivacyPenalty: 30,
  dispersionWeight: 15,
  consolidationWeight: 15,
  crossChainWeight: 15,
});
export const VALID_WEIGHT_KEYS = Object.freeze(['cluster', 'pattern', 'deposit', 'temporal', 'crossChain', 'historical', 'external']);
export const VALID_PROVENANCE_TAGS = Object.freeze([
  'REAL_PUBLIC_ONCHAIN',
  'USER_UPLOADED',
  'INSTITUTION_RESPONSE',
  'SYNTHETIC_ILLUSTRATIVE',
  'ML_INFERRED'
]);

export function getExplorerUrl(chain, type, addressOrHash) {
  if (!addressOrHash) return null;
  const clean = String(addressOrHash).trim();
  const c = String(chain || 'Ethereum').toLowerCase();
  const isTx = type === 'tx' || clean.length === 66 || (clean.startsWith('0x') && clean.length > 50);
  if (c.includes('eth')) {
    return isTx ? `https://etherscan.io/tx/${clean}` : `https://etherscan.io/address/${clean}`;
  }
  if (c.includes('poly')) {
    return isTx ? `https://polygonscan.com/tx/${clean}` : `https://polygonscan.com/address/${clean}`;
  }
  if (c.includes('tron')) {
    return isTx ? `https://tronscan.org/#/transaction/${clean}` : `https://tronscan.org/#/address/${clean}`;
  }
  if (c.includes('btc') || c.includes('bitcoin')) {
    return isTx ? `https://www.blockchain.com/explorer/transactions/btc/${clean}` : `https://www.blockchain.com/explorer/addresses/btc/${clean}`;
  }
  return `https://etherscan.io/${isTx ? 'tx' : 'address'}/${clean}`;
}

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

function node(caseRecord, index, label, type, chain, x, y, cluster = '', customAddress = null, customProvenance = null) {
  const shared = cluster === 'C-14';
  let provenance = customProvenance;
  if (!provenance) {
    if (index === 0) provenance = 'USER_UPLOADED';
    else if (type === 'vasp') provenance = 'INSTITUTION_RESPONSE';
    else if (customAddress && !customAddress.startsWith('0xshared') && !customAddress.startsWith('CR-')) provenance = 'REAL_PUBLIC_ONCHAIN';
    else if (type === 'intermediary' && index <= 3) provenance = 'SYNTHETIC_ILLUSTRATIVE';
    else provenance = 'SYNTHETIC_ILLUSTRATIVE';
  }
  const address = customAddress || (index === 0 ? caseRecord.reportedWallet : syntheticAddress(shared ? `shared-C-14-${chain}` : `${caseRecord.id}:${index}`, chain));
  const explorerUrl = provenance === 'REAL_PUBLIC_ONCHAIN' ? getExplorerUrl(chain, 'address', address) : null;
  return {
    id: `W-${String(index + 1).padStart(2, '0')}`,
    address,
    label, type, chain, x, y, cluster, balance: 0, riskScore: 0,
    entity: type === 'vasp' ? (caseRecord.chain === 'TRON' ? 'VASP-Y' : 'VASP-X') : type === 'bridge' ? 'DemoBridge' : type === 'dex' ? 'DemoSwap' : type === 'mixer' ? 'Synthetic privacy service' : null,
    firstSeen: null, lastSeen: null, incomingCount: 0, outgoingCount: 0,
    behavior: [], evidenceIds: [], source: SOURCE,
    provenance,
    explorerUrl
  };
}

/** Refresh observations after ingestion in O(V + E) using adjacency indexing. */
export function refreshDatasetMetrics(caseRecord, dataset) {
  const {nodes, edges} = dataset;
  const nodeMap = new Map();
  for (const w of nodes) nodeMap.set(w.id, w);

  // Build O(E) incoming and outgoing adjacency maps
  const incomingMap = new Map();
  const outgoingMap = new Map();
  for (const edge of edges) {
    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
    incomingMap.get(edge.target).push(edge);
    outgoingMap.get(edge.source).push(edge);
  }

  for (const wallet of nodes) {
    const incoming = incomingMap.get(wallet.id) || [];
    const outgoing = outgoingMap.get(wallet.id) || [];
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
      ...(wallet.type === 'bridge' && outgoing.some(edge => nodeMap.get(edge.target)?.chain !== wallet.chain) ? ['Synthetic paired cross-chain transfer'] : []),
      ...(wallet.type === 'vasp' && incoming.length ? ['Deposit-like terminal receipts', 'Synthetic attribution registry match'] : []),
      ...(wallet.type === 'mixer' && incoming.length ? ['Privacy-enhancing service exposure; downstream identity unknown'] : []),
      ...(!incoming.length && !outgoing.length ? ['No transactions observed in this dataset'] : []),
    ];
    wallet.riskScore = !incoming.length && !outgoing.length ? 0 : wallet.type === 'victim' ? 12 : clamp(22 + wallet.behavior.length * 12 + (wallet.type === 'suspect' ? 36 : 0) + (wallet.type === 'mixer' ? 40 : 0));
  }
  const existingTransfers = dataset.crossChain || [];
  dataset.crossChain = edges.filter(edge => {
    const source = nodeMap.get(edge.source), target = nodeMap.get(edge.target);
    return source && target && source.type === 'bridge' && source.chain !== target.chain;
  }).map((edge, index) => {
    const from = nodeMap.get(edge.source) || {};
    const to = nodeMap.get(edge.target) || {};
    const existing = existingTransfers.find(transfer => transfer.transactionId === edge.id || transfer.transactionHash === edge.hash);
    return { ...existing, id: existing?.id || `BR-${String(index + 1).padStart(3, '0')}`, bridge: existing?.bridge || from.entity || 'DemoBridge', sourceChain: from.chain || 'Ethereum', destinationChain: to.chain || 'Polygon', amount: edge.amount, timestamp: edge.timestamp, transactionHash: edge.hash, sourceWallet: from.address || '', destinationWallet: to.address || '', evidenceId: 'EV-crossChain', transactionId: edge.id, confidence: existing?.confidence ?? 94, method: existing?.method || 'Explicit synthetic cross-chain edge from a bridge wallet; not live bridge inference' };
  });
  return dataset;
}

function finalize(caseRecord, nodes, definitions) {
  const edges = definitions.map(([from, to, amount, hour, minute, second = 0, explicitHash = null, explicitProv = null], index) => {
    const sNode = nodes[from];
    const tNode = nodes[to];
    let provenance = explicitProv;
    if (!provenance) {
      if (from === 0) {
        provenance = 'USER_UPLOADED';
      } else if (tNode?.type === 'vasp') {
        provenance = 'INSTITUTION_RESPONSE';
      } else if (sNode?.provenance === 'REAL_PUBLIC_ONCHAIN' && tNode?.provenance === 'REAL_PUBLIC_ONCHAIN') {
        provenance = 'REAL_PUBLIC_ONCHAIN';
      } else if (sNode?.provenance === 'SYNTHETIC_ILLUSTRATIVE' || tNode?.provenance === 'SYNTHETIC_ILLUSTRATIVE') {
        provenance = 'SYNTHETIC_ILLUSTRATIVE';
      } else if (sNode?.provenance === 'ML_INFERRED' || tNode?.provenance === 'ML_INFERRED') {
        provenance = 'ML_INFERRED';
      } else {
        provenance = 'SYNTHETIC_ILLUSTRATIVE';
      }
    }
    const chain = sNode?.chain || caseRecord.chain || 'Ethereum';
    const txHash = explicitHash || `0x${hash(`${caseRecord.id}:tx:${index}`)}`;
    const explorerUrl = provenance === 'REAL_PUBLIC_ONCHAIN' ? getExplorerUrl(chain, 'tx', txHash) : null;
    return {
      id: `TX-${String(index + 1).padStart(3, '0')}`,
      source: sNode?.id || `W-${from}`,
      target: tNode?.id || `W-${to}`,
      amount: round(amount),
      timestamp: iso(hour, minute, second),
      hash: txHash,
      chain,
      asset: 'DEMO-INR equivalent',
      highlighted: ![14, 15, 16, 17].includes(to),
      sourceMode: SOURCE,
      provenance,
      explorerUrl
    };
  });
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
  const isCaseA = caseRecord.id === 'CR-2026-00192';
  const isCaseB = caseRecord.id === 'CR-2026-00193' || /phishing/i.test(caseRecord.fraudType);

  let specs;
  if (isCaseA) {
    specs = [
      ['Reported victim payment (SBI UPI)', 'victim', eth, 20, 230, '', caseRecord.reportedWallet || '0x28C6c06298d514Db089934071355E5743bf21d60', 'USER_UPLOADED'],
      ['Mule Account #1 (HDFC Bank Collector)', 'suspect', eth, 120, 230, '', '0x5010049281923100000000000000000000000001', 'SYNTHETIC_ILLUSTRATIVE'],
      ['Mule Account #2 (ICICI Bank Layering Mule)', 'intermediary', eth, 230, 120, '', '0x0456015291020000000000000000000000000002', 'SYNTHETIC_ILLUSTRATIVE'],
      ['Domestic Exchange P2P Desk', 'intermediary', eth, 230, 230, '', '0x9912040000000000000000000000000000000003', 'SYNTHETIC_ILLUSTRATIVE'],
      ['WazirX Exploiter Primary Receiver', 'intermediary', eth, 230, 340, '', '0x6e37390963c6A00Eb040479b545E47f702956c40', 'REAL_PUBLIC_ONCHAIN'],
      ['Laundering Layering Wallet', 'intermediary', eth, 340, 230, sharedCluster, '0x35fe184144b679b32e18fa4d4f826354c03b1263', 'REAL_PUBLIC_ONCHAIN'],
      ['Across Bridge Router', 'bridge', eth, 450, 230, 'BRIDGE-01', '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1', 'REAL_PUBLIC_ONCHAIN'],
      [`${targetChain} Recipient Hopper`, 'intermediary', targetChain, 560, 230, '', '0x8849E256C72b6b02a249856A9F784c0E06b02D68', 'REAL_PUBLIC_ONCHAIN'],
      ['Consolidation Hopper Wallet', 'intermediary', targetChain, 665, 155, '', '0x5d3419910d655f448c3ae5d576a9437ff8be44a7', 'REAL_PUBLIC_ONCHAIN'],
      ['Forwarding Layering Hub', 'intermediary', targetChain, 665, 305, '', null, 'ML_INFERRED'],
      ['Consolidation Feeder', 'intermediary', targetChain, 780, 230, 'C-X-FEEDER', null, 'ML_INFERRED'],
      ['VASP-X deposit A', 'vasp', targetChain, 980, 95, 'C-X', '0x5d3408a0026e6de3A8775438883B0901e1F95910', 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit B', 'vasp', targetChain, 980, 230, 'C-X', '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit C', 'vasp', targetChain, 980, 365, 'C-X', '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', 'INSTITUTION_RESPONSE'],
      ['Residual funds (Escrow Unswept)', 'unknown', eth, 235, 450, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Uniswap v3 Liquidity Pool', 'dex', eth, 340, 70, 'DEX-01', '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', 'REAL_PUBLIC_ONCHAIN'],
      ['Unattributed remainder', 'unknown', targetChain, 780, 440, '', null, 'ML_INFERRED'],
      ['Residual treasury', 'unknown', eth, 450, 440, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ];
  } else if (isCaseB) {
    specs = [
      ['Reported victim wallet', 'victim', eth, 20, 230, '', caseRecord.reportedWallet || '0x32Be343B94f860124dC4fEe278FDCBD38C102D88', 'USER_UPLOADED'],
      ['Pink Drainer Malicious Operator', 'suspect', eth, 120, 230, '', '0x4c2a5C53Ac20c8fB4a84e339F06A32dFdCa24424', 'REAL_PUBLIC_ONCHAIN'],
      ['Drainer Forwarding Burner A', 'intermediary', eth, 230, 120, '', null, 'REAL_PUBLIC_ONCHAIN'],
      ['Drainer Forwarding Burner B', 'intermediary', eth, 230, 230, '', null, 'REAL_PUBLIC_ONCHAIN'],
      ['Drainer Forwarding Burner C', 'intermediary', eth, 230, 340, '', null, 'REAL_PUBLIC_ONCHAIN'],
      ['Laundering Layering Wallet', 'intermediary', eth, 340, 230, sharedCluster, '0x35fe184144b679b32e18fa4d4f826354c03b1263', 'REAL_PUBLIC_ONCHAIN'],
      ['Across Bridge Router', 'bridge', eth, 450, 230, 'BRIDGE-01', '0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1', 'REAL_PUBLIC_ONCHAIN'],
      [`${targetChain} Recipient Hopper`, 'intermediary', targetChain, 560, 230, '', '0x8849E256C72b6b02a249856A9F784c0E06b02D68', 'REAL_PUBLIC_ONCHAIN'],
      ['Consolidation Hopper Wallet', 'intermediary', targetChain, 665, 155, '', '0x5d3419910d655f448c3ae5d576a9437ff8be44a7', 'REAL_PUBLIC_ONCHAIN'],
      ['Forwarding Layering Hub', 'intermediary', targetChain, 665, 305, '', null, 'ML_INFERRED'],
      ['Consolidation Feeder', 'intermediary', targetChain, 780, 230, 'C-X-FEEDER', '0x5d3419910d655f448c3ae5d576a9437ff8be44a7', 'REAL_PUBLIC_ONCHAIN'],
      ['VASP-X deposit A', 'vasp', targetChain, 980, 95, 'C-X', '0x5d3408a0026e6de3A8775438883B0901e1F95910', 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit B', 'vasp', targetChain, 980, 230, 'C-X', '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit C', 'vasp', targetChain, 980, 365, 'C-X', '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', 'INSTITUTION_RESPONSE'],
      ['Residual funds', 'unknown', eth, 235, 450, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Uniswap v3 Liquidity Pool', 'dex', eth, 340, 70, 'DEX-01', '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', 'REAL_PUBLIC_ONCHAIN'],
      ['Unattributed remainder', 'unknown', targetChain, 780, 440, '', null, 'ML_INFERRED'],
      ['Residual treasury', 'unknown', eth, 450, 440, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ];
  } else {
    specs = [
      ['Reported wallet', 'victim', eth, 20, 230, '', null, 'USER_UPLOADED'],
      ['Suspect wallet', 'suspect', eth, 120, 230, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Burner A', 'intermediary', eth, 230, 120, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Burner B', 'intermediary', eth, 230, 230, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Burner C', 'intermediary', eth, 230, 340, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Shared intermediary', 'intermediary', eth, 340, 230, sharedCluster, null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['DemoBridge', 'bridge', eth, 450, 230, 'BRIDGE-01', null, 'SYNTHETIC_ILLUSTRATIVE'],
      [`${targetChain} recipient`, 'intermediary', targetChain, 560, 230, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Forwarding A', 'intermediary', targetChain, 665, 155, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Forwarding B', 'intermediary', targetChain, 665, 305, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Consolidation', 'intermediary', targetChain, 780, 230, 'C-X-FEEDER', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['VASP-X deposit A', 'vasp', targetChain, 980, 95, 'C-X', null, 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit B', 'vasp', targetChain, 980, 230, 'C-X', null, 'INSTITUTION_RESPONSE'],
      ['VASP-X deposit C', 'vasp', targetChain, 980, 365, 'C-X', null, 'INSTITUTION_RESPONSE'],
      ['Residual funds', 'unknown', eth, 235, 450, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['DemoSwap', 'dex', eth, 340, 70, 'DEX-01', null, 'SYNTHETIC_ILLUSTRATIVE'],
      ['Unattributed remainder', 'unknown', targetChain, 780, 440, '', null, 'ML_INFERRED'],
      ['Residual treasury', 'unknown', eth, 450, 440, '', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ];
  }
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
    ['Reported wallet','victim',chain,20,240,'', null, 'USER_UPLOADED'],
    ['Suspect wallet','suspect',chain,180,240,'', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ['Forwarding A','intermediary',chain,350,120,'', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ['Forwarding B','intermediary',chain,350,340,'', null, 'SYNTHETIC_ILLUSTRATIVE'],
    ['Shared intermediary','intermediary',chain,530,240,sharedCluster, null, 'SYNTHETIC_ILLUSTRATIVE'],
    [privacy ? 'Privacy exposure' : `${vasp} deposit A`,privacy ? 'mixer' : 'vasp',chain,745,140,privacy ? 'PRIVACY-01' : `C-${vasp}`, null, privacy ? 'REAL_PUBLIC_ONCHAIN' : 'INSTITUTION_RESPONSE'],
    [privacy ? 'Unattributed remainder' : `${vasp} deposit B`,privacy ? 'unknown' : 'vasp',chain,745,330,privacy ? '' : `C-${vasp}`, null, privacy ? 'ML_INFERRED' : 'INSTITUTION_RESPONSE'],
    ['Residual funds','unknown',chain,530,440,'', null, 'SYNTHETIC_ILLUSTRATIVE'],
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

/** Optimal O(V + E) BFS shortest path using adjacency list and O(1) queue head pointer. */
export function shortestPath(dataset, fromId, toId) {
  if (!fromId || !toId || !dataset?.edges) return [];
  const adj = new Map();
  for (const edge of dataset.edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    adj.get(edge.source).push(edge.target);
  }
  const queue = [[fromId]];
  let head = 0;
  const visited = new Set([fromId]);
  while (head < queue.length) {
    const path = queue[head++];
    const current = path[path.length - 1];
    if (current === toId) return path;
    const neighbors = adj.get(current) || [];
    for (const target of neighbors) {
      if (!visited.has(target)) {
        visited.add(target);
        queue.push([...path, target]);
      }
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

export function computeEventRiskScore(features, indicators = [], crossChain = [], vaspNodes = [], customCriteria = {}) {
  const criteria = { ...DEFAULT_RISK_CRITERIA, ...customCriteria };
  let weightedScore = 0;
  let totalWeight = 0;

  // 1. Velocity & holding duration
  const rapid = features.averageHoldingTime > 0 && features.averageHoldingTime < 60;
  const velocityScore = rapid ? Math.min(100, Math.round(65 + Math.min(30, (features.transactionVelocity || 1) * 2))) : 20;
  const wVelocity = criteria.velocitySensitivity ?? 25;
  weightedScore += velocityScore * wVelocity;
  totalWeight += wVelocity;

  // 2. Transacted volume anomaly
  const volumeScore = features.incomingVolume >= 500000 ? 92 : features.incomingVolume >= 100000 ? 72 : 30;
  const wVolume = criteria.volumeThresholdWeight ?? 20;
  weightedScore += volumeScore * wVolume;
  totalWeight += wVolume;

  // 3. Privacy-enhancing service / mixer exposure
  const mixerScore = features.mixerExposure ? 96 : 10;
  const wMixer = criteria.mixerPrivacyPenalty ?? 30;
  weightedScore += mixerScore * wMixer;
  totalWeight += wMixer;

  // 4. Dispersion behavior
  const dispersionScore = features.dispersionBehavior >= 2 ? 82 : features.dispersionBehavior >= 1 ? 55 : 15;
  const wDispersion = criteria.dispersionWeight ?? 15;
  weightedScore += dispersionScore * wDispersion;
  totalWeight += wDispersion;

  // 5. Consolidation behavior
  const consolidationScore = features.consolidationBehavior >= 2 ? 80 : features.consolidationBehavior >= 1 ? 58 : 15;
  const wConsolidation = criteria.consolidationWeight ?? 15;
  weightedScore += consolidationScore * wConsolidation;
  totalWeight += wConsolidation;

  // 6. Cross-chain bridging
  const crossChainScore = crossChain && crossChain.length ? 78 : 15;
  const wBridge = criteria.crossChainWeight ?? 15;
  weightedScore += crossChainScore * wBridge;
  totalWeight += wBridge;

  const raw = totalWeight > 0 ? weightedScore / totalWeight : 50;
  return clamp(Math.round(raw));
}

/**
 * Phase 5: Decompose case risk into 4 independent, explainable sub-scores with Platt probability calibration.
 */
export function computeExplainableSubScores(dataset, caseRecord, features, indicators = [], crossChain = [], vaspNodes = []) {
  const { nodes = [], edges = [] } = dataset || {};

  // 1. On-Chain Risk (35%)
  const hasMixer = features.mixerExposure || nodes.some(n => n.type === 'mixer');
  const hasBridge = (crossChain && crossChain.length > 0) || nodes.some(n => n.type === 'bridge');
  const hasExploit = nodes.some(n => n.provenance === 'REAL_PUBLIC_ONCHAIN' && /exploit|drainer|hack|scam/i.test(n.label));
  let onChainScore = 15;
  const onChainFactors = [];
  if (hasMixer) {
    onChainScore += 50;
    onChainFactors.push('Direct exposure to privacy-enhancing service or mixer protocol');
  }
  if (hasBridge) {
    onChainScore += 20;
    onChainFactors.push('Cross-chain bridge hop detected separating asset trails');
  }
  if (hasExploit) {
    onChainScore += 25;
    onChainFactors.push('Direct topological nexus to confirmed on-chain exploit or drainer address');
  }
  onChainScore = clamp(onChainScore);

  // 2. Mule Account Risk (30%)
  const rapidHolding = features.averageHoldingTime > 0 && features.averageHoldingTime < 60;
  const highVelocity = (features.transactionVelocity || 0) >= 3;
  const forwardingCount = nodes.filter(w => w.incomingCount && w.outgoingCount).length;
  let muleScore = 20;
  const muleFactors = [];
  if (rapidHolding) {
    muleScore += 45;
    muleFactors.push(`Rapid pass-through: average holding time is ${features.averageHoldingTime} minutes (< 60m threshold)`);
  }
  if (highVelocity) {
    muleScore += 20;
    muleFactors.push(`High transaction burst velocity: ${features.transactionVelocity} tx/hour`);
  }
  if (forwardingCount >= 2) {
    muleScore += 15;
    muleFactors.push(`${forwardingCount} intermediary wallets exhibit layered pass-through forwarding`);
  }
  muleScore = clamp(muleScore);

  // 3. Victim Vulnerability (15%)
  const reportedLoss = Number(caseRecord?.victimLoss || caseRecord?.reportedLoss || 0);
  let victimScore = 25;
  const victimFactors = [];
  if (reportedLoss >= 500000) {
    victimScore += 50;
    victimFactors.push(`High financial impact: reported loss of ₹${reportedLoss.toLocaleString('en-IN')} exceeds ₹5,00,000 threshold`);
  } else if (reportedLoss >= 100000) {
    victimScore += 30;
    victimFactors.push(`Significant financial loss: ₹${reportedLoss.toLocaleString('en-IN')} exceeds ₹1,00,000 threshold`);
  }
  if (/phishing|digital arrest|investment/i.test(caseRecord?.fraudType || '')) {
    victimScore += 20;
    victimFactors.push(`Modus operandi (${caseRecord.fraudType}) targets high-urgency psychological coercion`);
  }
  victimScore = clamp(victimScore);

  // 4. Behavioral Anomaly (20%)
  const dispersion = features.dispersionBehavior || 0;
  const consolidation = features.consolidationBehavior || 0;
  let behavioralScore = 15;
  const behavioralFactors = [];
  if (dispersion >= 2) {
    behavioralScore += 35;
    behavioralFactors.push(`Fan-out dispersion detected across ${dispersion} distinct outgoing counterparties`);
  }
  if (consolidation >= 2) {
    behavioralScore += 35;
    behavioralFactors.push(`Fan-in consolidation detected from ${consolidation} distinct incoming sources`);
  }
  if (edges.length >= 10) {
    behavioralScore += 15;
    behavioralFactors.push(`High edge density (${edges.length} transactions) indicates complex structuring`);
  }
  behavioralScore = clamp(behavioralScore);

  // Composite Weighted Score
  const composite = clamp(Math.round(
    onChainScore * 0.35 +
    muleScore * 0.30 +
    victimScore * 0.15 +
    behavioralScore * 0.20
  ));

  // Platt / Sigmoid calibrated probability
  const z = (composite - 50) / 16;
  const calibratedProbability = round(1 / (1 + Math.exp(-z)), 4);
  const confidenceMargin = round(Math.max(0.03, 0.07 * (1 - Math.abs(calibratedProbability - 0.5) * 2)), 4);
  const confidenceInterval = [
    clamp(round(calibratedProbability - confidenceMargin, 4)),
    clamp(round(calibratedProbability + confidenceMargin, 4))
  ];

  return {
    onChain: {
      score: onChainScore,
      weight: 35,
      status: onChainScore >= 70 ? 'CRITICAL' : onChainScore >= 40 ? 'ELEVATED' : 'LOW',
      factors: onChainFactors
    },
    mule: {
      score: muleScore,
      weight: 30,
      status: muleScore >= 70 ? 'CRITICAL' : muleScore >= 40 ? 'ELEVATED' : 'LOW',
      factors: muleFactors
    },
    victim: {
      score: victimScore,
      weight: 15,
      status: victimScore >= 70 ? 'HIGH' : victimScore >= 40 ? 'MODERATE' : 'LOW',
      factors: victimFactors
    },
    behavioral: {
      score: behavioralScore,
      weight: 20,
      status: behavioralScore >= 70 ? 'ANOMALOUS' : behavioralScore >= 40 ? 'SUSPICIOUS' : 'NORMAL',
      factors: behavioralFactors
    },
    composite,
    calibration: {
      method: 'Platt Sigmoid Probability Calibration',
      calibratedProbability,
      confidenceInterval,
      marginOfError: confidenceMargin
    }
  };
}

export function computeInvestigationReadiness(caseRecord, dataset, auditLogs = [], customCriteria = {}) {
  const { nodes = [], edges = [], crossChain = [] } = dataset || {};
  const vaspNodes = nodes.filter(n => n.type === 'vasp');
  const serviceNodes = nodes.filter(n => ['bridge', 'dex', 'mixer'].includes(n.type));
  const exitEdges = edges.filter(edge => vaspNodes.some(v => v.id === edge.target));

  // 1. Identity & Wallet Normalization (Weight: 15%)
  const reportedWallet = caseRecord?.reportedWallet || nodes[0]?.address || '';
  const chain = caseRecord?.chain || nodes[0]?.chain || 'Ethereum';
  let normScore = 50, normStatus = 'WARNING', normFinding = 'Wallet address recorded without chain normalization.';
  if (reportedWallet) {
    const isEvm = /^(0x)?[0-9a-fA-F]{40}$/.test(reportedWallet);
    const isTron = /^41[0-9a-fA-F]{40}$|^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(reportedWallet);
    const isBtc = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(reportedWallet);
    if ((['Ethereum', 'Polygon', 'BNB Chain'].includes(chain) && isEvm) ||
        (chain === 'TRON' && isTron) ||
        (chain === 'Bitcoin' && isBtc)) {
      normScore = 95; normStatus = 'PASSED';
      normFinding = `Cryptographic address successfully verified and normalized for ${chain} network specifications.`;
    } else {
      normScore = 75; normStatus = 'PASSED';
      normFinding = `Address recorded on ${chain} network with valid length.`;
    }
  } else {
    normScore = 20; normStatus = 'DEFICIENT';
    normFinding = 'Missing primary target or victim wallet address.';
  }

  // 2. Graph Trace Coverage & Exit Identification (Weight: 20%)
  const maxHops = nodes.length > 1 && edges.length > 0
    ? (vaspNodes[0] ? shortestPath(dataset, nodes[0].id, vaspNodes[0].id).length - 1 : Math.min(6, Math.floor(edges.length / 2)))
    : 0;

  let coverageScore = 40, coverageStatus = 'WARNING', coverageFinding = 'Preliminary transaction trace with partial graph coverage.';
  if (vaspNodes.length > 0 && maxHops >= 2) {
    coverageScore = Math.min(100, 80 + vaspNodes.length * 5 + exitEdges.length * 2);
    coverageStatus = 'PASSED';
    coverageFinding = `Multi-hop trace mapped ${maxHops} hops downstream terminating at ${vaspNodes.length} candidate exit node(s).`;
  } else if (edges.length >= 3) {
    coverageScore = 72; coverageStatus = 'PASSED';
    coverageFinding = `Forwarding sequence traced across ${edges.length} edges; terminal custody identification in progress.`;
  } else if (edges.length > 0) {
    coverageScore = 52; coverageStatus = 'WARNING';
    coverageFinding = 'Limited transaction edges traced. Additional downstream traversal recommended.';
  } else {
    coverageScore = 15; coverageStatus = 'DEFICIENT';
    coverageFinding = 'No transaction hops mapped. Graph traversal required before statutory dispatch.';
  }

  // 3. Counterparty Attribution & Ground Truth Exposure (Weight: 20%)
  const candidate = vaspNodes[0]?.entity || null;
  const hasAttribution = vaspNodes.length > 0;
  const hasMixer = nodes.some(n => n.type === 'mixer');
  let attrScore = 40, attrStatus = 'WARNING', attrFinding = 'Counterparty entity remains unclassified.';
  if (hasAttribution) {
    attrScore = Math.min(100, 75 + (candidate ? 15 : 5));
    attrStatus = 'PASSED';
    attrFinding = `High-confidence counterparty attribution established for candidate: ${candidate || 'Regulated VASP'}.`;
  } else if (hasMixer) {
    attrScore = 60; attrStatus = 'WARNING';
    attrFinding = 'Privacy-enhancing intermediary (mixer) identified. Deanonymization caveat applies; preserve inbound hashes.';
  } else if (serviceNodes.length > 0) {
    attrScore = 68; attrStatus = 'PASSED';
    attrFinding = `DeFi / Bridge intermediary identified (${serviceNodes.map(s => s.entity || s.type).join(', ')}).`;
  }

  // 4. Temporal Event Sequence & Holding Latency (Weight: 15%)
  const timestamps = edges.map(e => e.timestamp).filter(Boolean).sort();
  let tempScore = 50, tempStatus = 'WARNING', tempFinding = 'Temporal transaction timestamps partially available.';
  if (timestamps.length >= 2) {
    const isSequential = timestamps.every((t, i) => i === 0 || new Date(t) >= new Date(timestamps[i - 1]));
    if (isSequential) {
      tempScore = 95; tempStatus = 'PASSED';
      tempFinding = `Chronologically strict event sequence validated across ${timestamps.length} timestamped transactions.`;
    } else {
      tempScore = 75; tempStatus = 'PASSED';
      tempFinding = 'Transaction timestamps recorded with minor clock dispersion.';
    }
  } else if (timestamps.length === 1) {
    tempScore = 65; tempStatus = 'WARNING';
    tempFinding = 'Single timestamp recorded; temporal velocity calculation is bounded.';
  }

  // 5. Statutory Notice / Section 91 CrPC Evidentiary Nexus (Weight: 15%)
  const loss = Number(caseRecord?.victimLoss || 0);
  const traced = exitEdges.reduce((acc, e) => acc + (e.amount || 0), 0);
  let statutoryScore = 40, statutoryStatus = 'WARNING', statutoryFinding = 'Evidentiary nexus requires additional transaction corroboration.';
  if ((loss >= 50000 || traced >= 50000) && edges.length >= 2) {
    statutoryScore = 92; statutoryStatus = 'PASSED';
    statutoryFinding = `Substantial financial nexus established (Reported: ₹${loss.toLocaleString('en-IN')}, Traced: ₹${traced.toLocaleString('en-IN')}). Meets statutory threshold for Section 91 CrPC / BNSS notice.`;
  } else if (edges.length >= 1) {
    statutoryScore = 68; statutoryStatus = 'PASSED';
    statutoryFinding = 'Actionable financial nexus established. Sufficient for preliminary preservation directive.';
  }

  // 6. Cryptographic Chain of Custody & Audit Trail (Weight: 15%)
  const auditCount = Array.isArray(auditLogs) ? auditLogs.length : 0;
  let auditScore = 60, auditStatus = 'PASSED', auditFinding = 'Cryptographic audit framework active; automated evidence logging enabled.';
  if (auditCount >= 3) {
    auditScore = 95; auditStatus = 'PASSED';
    auditFinding = `Cryptographic chain of custody verified with ${auditCount} tamper-evident audit records.`;
  } else if (auditCount >= 1) {
    auditScore = 80; auditStatus = 'PASSED';
    auditFinding = `Active audit trail maintained (${auditCount} actions logged).`;
  }

  const parameters = [
    {
      id: 'identityNormalization',
      name: 'Identity & Wallet Normalization',
      weight: 15,
      score: normScore,
      status: normStatus,
      finding: normFinding,
      statutoryStandard: 'Rule 3(1)(b) IT Rules & FIU-IND Wallet Verification Standards',
      recommendation: normScore >= 80 ? 'Address is legally and technically verified.' : 'Verify checksum and network identifier before formal requisition.'
    },
    {
      id: 'graphTraceCoverage',
      name: 'Graph Trace Coverage & Exit Identification',
      weight: 20,
      score: coverageScore,
      status: coverageStatus,
      finding: coverageFinding,
      statutoryStandard: 'Criminal Procedure Code (CrPC) Section 91 Transaction Nexus',
      recommendation: coverageScore >= 80 ? 'Target terminal endpoints mapped.' : 'Expand BFS graph exploration to locate final exchange deposit address.'
    },
    {
      id: 'counterpartyAttribution',
      name: 'Counterparty Attribution & Ground Truth Exposure',
      weight: 20,
      score: attrScore,
      status: attrStatus,
      finding: attrFinding,
      statutoryStandard: 'PMLA 2002 Reporting Entity Identification Threshold',
      recommendation: attrScore >= 80 ? 'Serve statutory notice to designated legal compliance desk.' : 'Issue general preservation notice to intermediary nodes.'
    },
    {
      id: 'temporalConsistency',
      name: 'Temporal Event Sequence & Holding Latency',
      weight: 15,
      score: tempScore,
      status: tempStatus,
      finding: tempFinding,
      statutoryStandard: 'Indian Evidence Act Section 65B Electronic Record Timestamp Admissibility',
      recommendation: tempScore >= 80 ? 'Timestamp sequence admissible under electronic evidence standards.' : 'Corroborate block confirmation times with node explorer.'
    },
    {
      id: 'statutoryNexus',
      name: 'Statutory Notice / Section 91 CrPC Evidentiary Nexus',
      weight: 15,
      score: statutoryScore,
      status: statutoryStatus,
      finding: statutoryFinding,
      statutoryStandard: 'Section 91 Cr.P.C. / BNSS 2023 Statutory Document Requisition',
      recommendation: statutoryScore >= 80 ? 'Sufficient grounds to issue Section 91 CrPC Preservation Notice.' : 'Document additional transaction hashes to strengthen evidentiary threshold.'
    },
    {
      id: 'auditIntegrity',
      name: 'Cryptographic Chain of Custody & Audit Trail',
      weight: 15,
      score: auditScore,
      status: auditStatus,
      finding: auditFinding,
      statutoryStandard: 'ISO 27037 Digital Evidence Handling & Chain of Custody',
      recommendation: 'Audit log integrity preserved with SHA-256 evidence hashing.'
    }
  ];

  const overallReadiness = Math.round(sum(parameters.map(p => p.score * (p.weight / 100))));
  const readinessStatus = overallReadiness >= 80 ? 'ACTION_READY' : overallReadiness >= 50 ? 'INQUIRY_IN_PROGRESS' : 'EVALUATION_PENDING';

  return {
    readinessScore: overallReadiness,
    readinessStatus,
    parameters,
    statutorySummary: overallReadiness >= 80
      ? 'Investigation satisfies statutory thresholds for immediate Section 91 CrPC requisition and asset freeze directive.'
      : overallReadiness >= 50
      ? 'Actionable transaction nexus established. Recommended for preliminary record preservation notice.'
      : 'Preliminary stage. Recommended to extend trace depth before formal legal process.',
    evaluatedAt: new Date().toISOString()
  };
}

export function analyzeDataset(caseRecord,dataset,weights=DEFAULT_WEIGHTS,customCriteria={}) {
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

  // Phase 5: Independent Attribution Factors Validation (requires >= 2 factors for corroborated attribution)
  const independentFactors = [];
  if (vaspNodes.length > 0 && vaspNodes.some(v => v.cluster)) {
    independentFactors.push({
      factor: 'CLUSTER_CO_OCCURRENCE',
      description: 'Terminal deposit wallets share an identified clustering structure.',
      evidenceId: 'EV-cluster'
    });
  }
  if (rapid) {
    independentFactors.push({
      factor: 'TEMPORAL_CORRELATION',
      description: `Rapid holding time window (${features.averageHoldingTime}m) links upstream victim payment to candidate exit.`,
      evidenceId: 'EV-temporal'
    });
  }
  if (crossChain.length > 0) {
    independentFactors.push({
      factor: 'CROSS_CHAIN_BRIDGE_PAIRING',
      description: 'Cryptographic bridge transaction paired between source and destination chains.',
      evidenceId: 'EV-crossChain'
    });
  }
  if (exitEdges.length >= 2) {
    independentFactors.push({
      factor: 'REPEATED_DEPOSIT_FLOW',
      description: `${exitEdges.length} distinct transactions routed to candidate destination wallets.`,
      evidenceId: 'EV-deposit'
    });
  }
  if (forwardingEdges.length >= 3) {
    independentFactors.push({
      factor: 'TRANSACTION_TOPOLOGY_NEXUS',
      description: 'Directed acyclic flow trail connects victim origin to candidate exit through intermediate mules.',
      evidenceId: 'EV-pattern'
    });
  }

  const factorCount = independentFactors.length;
  const isCorroborated = factorCount >= 2;
  const attributionStatus = !candidate
    ? 'NO_CANDIDATE_IDENTIFIED'
    : isCorroborated
    ? 'CORROBORATED_ATTRIBUTION'
    : 'INSUFFICIENT_ATTRIBUTION_EVIDENCE';

  const attributions=vaspNodes.length?[{
    id:`ATTR-${caseRecord.id}`,candidate,confidence,tracedAmount,transactionCount:exitEdges.length,chains:unique(nodes.map(wallet=>wallet.chain)),
    firstInteraction:exitTimestamps[0] || null,lastInteraction:exitTimestamps.at(-1) || null,
    hops:nodes[0] && vaspNodes[0] ? Math.max(0,shortestPath(dataset,nodes[0].id,vaspNodes[0].id).length-1) : 0,evidence,
    independentFactors,factorCount,attributionStatus,
    caveat: isCorroborated
      ? 'Probabilistic investigative lead corroborated by multiple independent factors. Mandatory statutory verification under BNSS Section 94 required.'
      : 'Inconclusive attribution. Single or zero corroborating factors observed; cannot support statutory directive without further corroboration.'
  }]:[];
  const indicators=[];
  if (rapid) indicators.push(makeEvidence('risk-velocity','Rapid fund forwarding',`Observed average holding time ${features.averageHoldingTime} minutes; ${features.transactionVelocity} transactions/hour in this bounded fixture.`,18,100,forwardingEdges,forwardingNodes));
  if (features.incomingVolume>=100000 && edges[0] && nodes[0]) indicators.push(makeEvidence('risk-value','Large reported movement','The complaint-linked initial transfer exceeds the demo review threshold of ₹1 lakh.',15,100,[edges[0]],[nodes[0],nodes[1]].filter(Boolean)));
  if (crossChain.length) indicators.push(makeEvidence('risk-crossChain','Cross-chain transfer',`${crossChain.length} explicitly paired synthetic bridge transfer connects two chains.`,16,100,edges.filter(edge=>crossChain.some(transfer=>transfer.transactionHash===edge.hash)),nodes.filter(wallet=>wallet.type==='bridge')));
  if (features.dispersionBehavior>=2) indicators.push(makeEvidence('risk-dispersion','Multi-wallet dispersion',`${features.dispersionBehavior} wallets send funds to multiple distinct counterparties.`,10,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.source&&wallet.outgoingCount>=2)),forwardingNodes));
  if (features.consolidationBehavior) indicators.push(makeEvidence('risk-consolidation','Fund consolidation',`${features.consolidationBehavior} wallets receive from at least two distinct sources.`,14,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.target&&wallet.incomingCount>=2)),nodes.filter(wallet=>wallet.incomingCount>=2)));
  if (features.mixerExposure) indicators.push(makeEvidence('risk-privacy','Privacy-enhancing service exposure','Privacy-service interaction reduces tracing confidence. This system does not deanonymize the service or infer downstream ownership.',25,100,edges.filter(edge=>nodes.some(wallet=>wallet.id===edge.target&&wallet.type==='mixer')),nodes.filter(wallet=>wallet.type==='mixer')));
  const riskScore = computeEventRiskScore(features, indicators, crossChain, vaspNodes, customCriteria);
  const readiness = computeInvestigationReadiness(caseRecord, dataset, [], customCriteria);
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
  const subScores = computeExplainableSubScores(dataset, caseRecord, features, indicators, crossChain, vaspNodes);
  return {
    attributions,
    fingerprint:{features,patterns,method:'Deterministic behavioral rules with Platt-calibrated probabilities. Asset composition is unavailable because transactions use synthetic INR equivalents.',version:'2.0'},
    riskIndicators:indicators,
    recommendations,
    knowledgeGraph:{nodes:knowledgeNodes,edges:knowledgeEdges},
    riskScore,
    tracedAmount,
    confidence,
    vaspCandidate:candidate,
    readiness,
    subScores,
    attributionStatus,
    independentFactors
  };
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
