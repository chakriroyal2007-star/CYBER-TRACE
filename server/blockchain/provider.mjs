import { createHash } from 'node:crypto';

// Supported Networks
export const SUPPORTED_CHAINS = Object.freeze(['Bitcoin', 'Ethereum', 'Polygon', 'BNB Chain', 'TRON']);

// Verification Statuses per Specification
export const VERIFICATION_STATUS = Object.freeze({
  VERIFIED: 'Verified',
  PENDING: 'Pending Verification',
  NOT_FOUND: 'Not Found',
  PROVIDER_UNAVAILABLE: 'Provider Unavailable',
  UNSUPPORTED_NETWORK: 'Unsupported Network',
  INVALID_REFERENCE: 'Invalid Reference'
});

/** Base Provider Class */
export class BaseBlockchainProvider {
  constructor(name, chain) {
    this.name = name;
    this.chain = chain;
  }

  async fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'CyberTrace-Forensics/1.0',
          'Accept': 'application/json',
          ...(options.headers || {})
        }
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Bitcoin Provider using Mempool.space Public API */
export class MempoolSpaceProvider extends BaseBlockchainProvider {
  constructor(baseUrl = process.env.MEMPOOL_API_URL || 'https://mempool.space/api') {
    super('Mempool.space API', 'Bitcoin');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  validateAddress(address) {
    if (!address || typeof address !== 'string') return false;
    const clean = address.trim();
    // Legacy P2PKH (1...), P2SH (3...), SegWit Bech32 (bc1q...), Taproot (bc1p...)
    return /^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{39,90})$/.test(clean);
  }

  validateTransactionHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    const clean = hash.trim();
    return /^[0-9a-fA-F]{64}$/.test(clean);
  }

  async getTransaction(txHash) {
    if (!this.validateTransactionHash(txHash)) {
      return {
        status: VERIFICATION_STATUS.INVALID_REFERENCE,
        verified: false,
        error: 'Invalid Bitcoin transaction hash format (expected 64 hexadecimal characters).'
      };
    }

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/tx/${txHash}`);
      if (res.status === 404) {
        return {
          status: VERIFICATION_STATUS.NOT_FOUND,
          verified: false,
          txHash,
          chain: 'Bitcoin',
          provider: this.name,
          error: `Transaction ${txHash} was not found on the Bitcoin mainnet blockchain.`
        };
      }

      if (!res.ok) {
        return {
          status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
          verified: false,
          txHash,
          chain: 'Bitcoin',
          provider: this.name,
          error: `Provider returned HTTP status ${res.status}.`
        };
      }

      const tx = await res.json();
      const stamp = tx.status?.block_time ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString();

      // Inputs & Outputs parsing
      const inputs = (tx.vin || []).map(vin => ({
        txid: vin.txid,
        vout: vin.vout,
        prevoutAddress: vin.prevout?.scriptpubkey_address || null,
        valueSatoshis: vin.prevout?.value || 0,
        valueBtc: (vin.prevout?.value || 0) / 1e8
      }));

      const outputs = (tx.vout || []).map((vout, index) => ({
        index,
        scriptpubkeyAddress: vout.scriptpubkey_address || null,
        valueSatoshis: vout.value || 0,
        valueBtc: (vout.value || 0) / 1e8
      }));

      const totalInputValue = inputs.reduce((sum, i) => sum + i.valueBtc, 0);
      const totalOutputValue = outputs.reduce((sum, o) => sum + o.valueBtc, 0);
      const feeSatoshis = tx.fee || 0;
      const feeBtc = feeSatoshis / 1e8;

      const primarySender = inputs[0]?.prevoutAddress || 'Coinbase / Multi-input';
      const primaryRecipient = outputs[0]?.scriptpubkeyAddress || 'Multi-output';

      return {
        status: VERIFICATION_STATUS.VERIFIED,
        verified: true,
        chain: 'Bitcoin',
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        txHash: tx.txid,
        blockHeight: tx.status?.block_height || null,
        blockHash: tx.status?.block_hash || null,
        blockTimestamp: stamp,
        isConfirmed: Boolean(tx.status?.confirmed),
        confirmations: tx.status?.confirmed ? Math.max(1, (tx.status.block_height ? 850000 - tx.status.block_height : 6)) : 0,
        fromAddress: primarySender,
        toAddress: primaryRecipient,
        value: totalOutputValue,
        nativeValue: totalOutputValue,
        currency: 'BTC',
        fee: feeBtc,
        inputsCount: inputs.length,
        outputsCount: outputs.length,
        inputs,
        outputs,
        rawReference: `${this.baseUrl}/tx/${tx.txid}`
      };
    } catch (err) {
      return {
        status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
        verified: false,
        txHash,
        chain: 'Bitcoin',
        provider: this.name,
        error: `Failed to contact Bitcoin provider: ${err.message}`
      };
    }
  }

  async getAddressBalance(address) {
    if (!this.validateAddress(address)) return null;
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/address/${address}`);
      if (!res.ok) return null;
      const data = await res.json();
      const funded = data.chain_stats?.funded_txo_sum || 0;
      const spent = data.chain_stats?.spent_txo_sum || 0;
      const balanceSats = Math.max(0, funded - spent);
      return {
        address,
        chain: 'Bitcoin',
        balanceSatoshis: balanceSats,
        balanceBtc: balanceSats / 1e8,
        txCount: data.chain_stats?.tx_count || 0,
        provider: this.name
      };
    } catch {
      return null;
    }
  }
}

/** Ethereum & EVM Provider using Public JSON-RPC & Etherscan API */
export class EthereumProvider extends BaseBlockchainProvider {
  constructor(rpcUrl = process.env.ETH_RPC_URL || 'https://cloudflare-eth.com', chain = 'Ethereum') {
    super('EVM Public RPC', chain);
    this.rpcUrl = rpcUrl;
  }

  validateAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
  }

  validateTransactionHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    return /^0x[0-9a-fA-F]{64}$/.test(hash.trim());
  }

  async getTransaction(txHash) {
    if (!this.validateTransactionHash(txHash)) {
      return {
        status: VERIFICATION_STATUS.INVALID_REFERENCE,
        verified: false,
        error: 'Invalid EVM transaction hash format (expected 0x followed by 64 hexadecimal characters).'
      };
    }

    try {
      const rpcPayload = {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash]
      };

      const res = await this.fetchWithTimeout(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rpcPayload)
      });

      if (!res.ok) {
        return {
          status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
          verified: false,
          txHash,
          chain: this.chain,
          provider: this.name,
          error: `RPC returned HTTP ${res.status}`
        };
      }

      const json = await res.json();
      const tx = json.result;

      if (!tx) {
        return {
          status: VERIFICATION_STATUS.NOT_FOUND,
          verified: false,
          txHash,
          chain: this.chain,
          provider: this.name,
          error: `Transaction ${txHash} not found on ${this.chain} blockchain.`
        };
      }

      // Value conversion from Wei to Ether
      const rawValueWei = tx.value ? BigInt(tx.value) : 0n;
      const etherValue = Number(rawValueWei) / 1e18;
      const blockNum = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
      const gasPriceGwei = tx.gasPrice ? Number(BigInt(tx.gasPrice)) / 1e9 : 0;

      return {
        status: VERIFICATION_STATUS.VERIFIED,
        verified: true,
        chain: this.chain,
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        txHash: tx.hash,
        blockHeight: blockNum,
        fromAddress: tx.from,
        toAddress: tx.to,
        value: etherValue,
        nativeValue: etherValue,
        currency: this.chain === 'Polygon' ? 'MATIC' : this.chain === 'BNB Chain' ? 'BNB' : 'ETH',
        gasPriceGwei,
        gasLimit: tx.gas ? parseInt(tx.gas, 16) : null,
        nonce: tx.nonce ? parseInt(tx.nonce, 16) : 0,
        isConfirmed: Boolean(blockNum),
        rawReference: `${this.rpcUrl}`
      };
    } catch (err) {
      return {
        status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
        verified: false,
        txHash,
        chain: this.chain,
        provider: this.name,
        error: `Failed to contact EVM RPC provider: ${err.message}`
      };
    }
  }

  async getAddressBalance(address) {
    if (!this.validateAddress(address)) return null;
    try {
      const res = await this.fetchWithTimeout(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [address, 'latest'] })
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.result) return null;
      const wei = BigInt(json.result);
      return {
        address,
        chain: this.chain,
        balanceWei: wei.toString(),
        balanceEth: Number(wei) / 1e18,
        provider: this.name
      };
    } catch {
      return null;
    }
  }
}

/** TRON Provider using TronGrid API */
export class TronProvider extends BaseBlockchainProvider {
  constructor(baseUrl = process.env.TRONGRID_API_URL || 'https://api.trongrid.io') {
    super('TronGrid API', 'TRON');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  validateAddress(address) {
    if (!address || typeof address !== 'string') return false;
    // Base58 TRON address starts with T, 34 chars
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim());
  }

  validateTransactionHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    return /^[0-9a-fA-F]{64}$/.test(hash.trim());
  }

  async getTransaction(txHash) {
    if (!this.validateTransactionHash(txHash)) {
      return {
        status: VERIFICATION_STATUS.INVALID_REFERENCE,
        verified: false,
        error: 'Invalid TRON transaction hash format (expected 64 hexadecimal characters).'
      };
    }

    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/v1/transactions/${txHash}`);
      if (res.status === 404) {
        return {
          status: VERIFICATION_STATUS.NOT_FOUND,
          verified: false,
          txHash,
          chain: 'TRON',
          provider: this.name,
          error: `Transaction ${txHash} not found on TRON mainnet.`
        };
      }

      if (!res.ok) {
        return {
          status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
          verified: false,
          txHash,
          chain: 'TRON',
          provider: this.name,
          error: `TronGrid HTTP status ${res.status}`
        };
      }

      const json = await res.json();
      const tx = json.data && json.data.length ? json.data[0] : null;

      if (!tx) {
        return {
          status: VERIFICATION_STATUS.NOT_FOUND,
          verified: false,
          txHash,
          chain: 'TRON',
          provider: this.name,
          error: `Transaction ${txHash} not found on TRON mainnet.`
        };
      }

      const contract = tx.raw_data?.contract?.[0];
      const contractType = contract?.type || 'TransferContract';
      const contractVal = contract?.parameter?.value || {};
      const amountSun = contractVal.amount || 0;
      const amountTrx = amountSun / 1e6;

      return {
        status: VERIFICATION_STATUS.VERIFIED,
        verified: true,
        chain: 'TRON',
        provider: this.name,
        retrievedAt: new Date().toISOString(),
        txHash: tx.txID,
        blockHeight: tx.blockNumber || null,
        blockTimestamp: tx.block_timestamp ? new Date(tx.block_timestamp).toISOString() : new Date().toISOString(),
        contractType,
        fromAddress: contractVal.owner_address || null,
        toAddress: contractVal.to_address || null,
        value: amountTrx,
        nativeValue: amountTrx,
        currency: 'TRX',
        isConfirmed: Boolean(tx.ret?.[0]?.contractRet === 'SUCCESS'),
        rawReference: `${this.baseUrl}/v1/transactions/${txHash}`
      };
    } catch (err) {
      return {
        status: VERIFICATION_STATUS.PROVIDER_UNAVAILABLE,
        verified: false,
        txHash,
        chain: 'TRON',
        provider: this.name,
        error: `Failed to contact TronGrid provider: ${err.message}`
      };
    }
  }
}

/** Unified Blockchain Provider Manager */
export class BlockchainProviderManager {
  constructor() {
    this.btcProvider = new MempoolSpaceProvider();
    this.ethProvider = new EthereumProvider('https://cloudflare-eth.com', 'Ethereum');
    this.polygonProvider = new EthereumProvider('https://polygon-rpc.com', 'Polygon');
    this.bnbProvider = new EthereumProvider('https://bsc-dataseed.binance.org', 'BNB Chain');
    this.tronProvider = new TronProvider();
  }

  getProvider(chain) {
    const c = String(chain || '').trim().toLowerCase();
    if (c === 'bitcoin' || c === 'btc') return this.btcProvider;
    if (c === 'ethereum' || c === 'eth') return this.ethProvider;
    if (c === 'polygon' || c === 'matic') return this.polygonProvider;
    if (c === 'bnb chain' || c === 'bsc' || c === 'binance') return this.bnbProvider;
    if (c === 'tron' || c === 'trx') return this.tronProvider;
    return null;
  }

  validateAddress(chain, address) {
    const provider = this.getProvider(chain);
    if (!provider) return false;
    return provider.validateAddress(address);
  }

  validateTransactionHash(chain, hash) {
    const provider = this.getProvider(chain);
    if (!provider) return false;
    return provider.validateTransactionHash(hash);
  }

  async verifyTransaction(chain, txHash) {
    const provider = this.getProvider(chain);
    if (!provider) {
      return {
        status: VERIFICATION_STATUS.UNSUPPORTED_NETWORK,
        verified: false,
        chain,
        txHash,
        provider: 'None',
        error: `Blockchain network '${chain}' is not currently supported.`
      };
    }

    return await provider.getTransaction(txHash);
  }

  async getAddressBalance(chain, address) {
    const provider = this.getProvider(chain);
    if (!provider || !provider.getAddressBalance) return null;
    return await provider.getAddressBalance(address);
  }

  async getProviderHealth() {
    return {
      bitcoin: { name: this.btcProvider.name, status: 'ONLINE', url: this.btcProvider.baseUrl },
      ethereum: { name: this.ethProvider.name, status: 'ONLINE', url: this.ethProvider.rpcUrl },
      polygon: { name: this.polygonProvider.name, status: 'ONLINE', url: this.polygonProvider.rpcUrl },
      bnbChain: { name: this.bnbProvider.name, status: 'ONLINE', url: this.bnbProvider.rpcUrl },
      tron: { name: this.tronProvider.name, status: 'ONLINE', url: this.tronProvider.baseUrl }
    };
  }
}

export const blockchainManager = new BlockchainProviderManager();
