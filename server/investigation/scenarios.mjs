// Fictional classroom inputs. Never used as ML training data or real crime evidence.
const transfer = (from, to, amount, seconds, network = 'UPI', asset = 'INR') => ({
  from,
  to,
  amount: String(amount),
  network,
  asset,
  timestamp: new Date(Date.UTC(2026, 10, 1, 10, 0, seconds)).toISOString(),
  reference: `CLASSROOM-${network}-${from}-${to}-${seconds}`
});

export const INVESTIGATION_SCENARIOS = [
  {
    key: 'investment-multihop',
    caseId: 'CR-2026-00192',
    title: 'Investment scam with multi-hop wallet transfers',
    objective: 'Follow reported deposits through 3 intermediary layering hops to an off-ramp liquidity pool. Distinguish fan-in aggregation from fan-out dispersal.',
    source: 'investor-victim',
    target: 'dex-liquidity-pool',
    wallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'Ethereum',
    transfers: [
      transfer('investor-victim', 'layer1-feeder', 812450, 0, 'Ethereum', 'USDT'),
      transfer('layer1-feeder', 'layer2-hopper', 805000, 300, 'Ethereum', 'USDT'),
      transfer('layer2-hopper', 'layer3-consolidator', 798000, 720, 'Ethereum', 'USDT'),
      transfer('layer3-consolidator', 'dex-liquidity-pool', 790000, 1200, 'Ethereum', 'USDT')
    ],
    expected: 'BFS establishes a 4-hop money trail; Dijkstra traces path of minimal slippage. Fan-in confirms Ponzi aggregation.'
  },
  {
    key: 'phishing-drainer',
    caseId: 'CR-2026-00193',
    title: 'Phishing / social-engineering cryptocurrency drain',
    objective: 'Detect instant permit drainer sweep within seconds of signature; follow tokens to unhosted intermediary stager.',
    source: 'phished-victim',
    target: 'tornado-cash-stager',
    wallet: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88',
    chain: 'Ethereum',
    transfers: [
      transfer('phished-victim', 'permit2-drainer-contract', 350000, 0, 'Ethereum', 'USDC'),
      transfer('permit2-drainer-contract', 'drainer-relay-a', 200000, 12, 'Ethereum', 'USDC'),
      transfer('permit2-drainer-contract', 'drainer-relay-b', 145000, 15, 'Ethereum', 'USDC'),
      transfer('drainer-relay-a', 'tornado-cash-stager', 198000, 60, 'Ethereum', 'USDC')
    ],
    expected: 'Sliding window identifies an instantaneous transfer burst (< 60s); fan-out dispersal marks automated smart contract drain.'
  },
  {
    key: 'mule-forwarding',
    caseId: 'CR-2026-00194',
    title: 'Mule wallet and rapid fund forwarding',
    objective: 'Trace rapid pass-through (< 1 hour holding duration) from victim UPI through domestic mule bank account into P2P crypto on-ramp.',
    source: 'victim-bank',
    target: 'p2p-arbitrage-desk',
    wallet: 'TLyqz4YmmYm179mFd3ErRo8LdtjvevM2CL',
    chain: 'TRON',
    transfers: [
      transfer('victim-bank', 'mule-bank-acc', 500000, 0, 'UPI', 'INR'),
      transfer('mule-bank-acc', 'p2p-escrow-wallet', 490000, 18, 'TRON', 'USDT'),
      transfer('p2p-escrow-wallet', 'tron-mule-1', 250000, 45, 'TRON', 'USDT'),
      transfer('p2p-escrow-wallet', 'tron-mule-2', 235000, 52, 'TRON', 'USDT'),
      transfer('tron-mule-1', 'p2p-arbitrage-desk', 248000, 80, 'TRON', 'USDT')
    ],
    expected: 'Temporal analysis flags severe burst velocity (holding period 18 mins). Section 106 BNSS bank lien notice required.'
  },
  {
    key: 'ransomware-trail',
    caseId: 'CR-2026-72301',
    title: 'Ransomware-related cryptocurrency payment trail',
    objective: 'Follow Bitcoin ransomware extortion payment across a peeling chain with peeling change outputs.',
    source: 'corporate-victim',
    target: 'unhosted-otc-mixer',
    wallet: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    chain: 'Bitcoin',
    transfers: [
      transfer('corporate-victim', 'lockbit-collector-wallet', 975000, 0, 'Bitcoin', 'BTC'),
      transfer('lockbit-collector-wallet', 'peel-hop-1', 900000, 1800, 'Bitcoin', 'BTC'),
      transfer('lockbit-collector-wallet', 'peeled-cut-1', 75000, 1800, 'Bitcoin', 'BTC'),
      transfer('peel-hop-1', 'peel-hop-2', 820000, 3600, 'Bitcoin', 'BTC'),
      transfer('peel-hop-2', 'unhosted-otc-mixer', 800000, 7200, 'Bitcoin', 'BTC')
    ],
    expected: 'DFS peeling chain algorithm detects progressive token shedding. Acyclic topology confirms single-direction extorted dissipation.'
  },
  {
    key: 'cross-chain-split',
    caseId: 'CR-2026-00195',
    title: 'Cross-chain bridge movement and fund splitting',
    objective: 'Detect funds split 60/40 across Across/Stargate protocol cross-chain bridges into Polygon and Arbitrum.',
    source: 'eth-fraud-contract',
    target: 'polygon-arbitrum-sinks',
    wallet: '0x35feE1bF76a16A621D0E03C9B224e7fF7560B8E1',
    chain: 'Ethereum',
    transfers: [
      transfer('eth-fraud-contract', 'across-bridge-deposit', 650000, 0, 'Ethereum', 'USDC'),
      transfer('across-bridge-deposit', 'polygon-receiver-a', 390000, 120, 'Polygon', 'USDC'),
      transfer('across-bridge-deposit', 'arbitrum-receiver-b', 255000, 140, 'Arbitrum', 'USDC')
    ],
    expected: 'Cross-chain tracer resolves multi-chain provenance. Fund-splitting ratio 60:40 detected across Layer 2 rollup endpoints.'
  },
  {
    key: 'vasp-attribution',
    caseId: 'CR-2026-00196',
    title: 'Exchange deposit or suspected service-endpoint attribution',
    objective: 'Attribute ultimate fund exit to a centralized exchange deposit vault (Binance Hot Vault 14) using deposit cluster heuristics.',
    source: 'syndicate-aggregator',
    target: 'binance-main-hot-vault-14',
    wallet: '0x28C6c06298d514Db089934071355E5743bf21d60',
    chain: 'Ethereum',
    transfers: [
      transfer('syndicate-aggregator', 'layering-relay', 480000, 0, 'Ethereum', 'USDT'),
      transfer('layering-relay', 'binance-user-deposit-addr', 475000, 600, 'Ethereum', 'USDT'),
      transfer('binance-user-deposit-addr', 'binance-main-hot-vault-14', 475000, 1800, 'Ethereum', 'USDT')
    ],
    expected: 'Bloom filter and label store match exchange omnibus hot wallet. Generates Section 91 CrPC statutory KYC notice for law enforcement.'
  }
];
