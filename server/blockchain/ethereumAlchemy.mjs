import { createHash } from 'node:crypto';

/**
 * Real Ethereum Blockchain Adapter powered by Alchemy API.
 * Connects directly to Ethereum Mainnet (Chain ID: 1) using real JSON-RPC and Alchemy Enhanced APIs.
 * Supports:
 * - Native ETH transfers
 * - alchemy_getAssetTransfers (ERC-20, ERC-721, ERC-1155, external, internal)
 * - Transaction receipts, execution status, gas fees, and confirmations
 * - Rate limiting, exponential backoff, retry logic, and provider health monitoring
 */
export class EthereumAlchemyAdapter {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.BLOCKCHAIN_API_KEY || 'alch_xJAA5YzTM0ZE6NZuxEmri';
    this.endpoint = options.endpoint || process.env.ALCHEMY_ENDPOINT || `https://eth-mainnet.g.alchemy.com/v2/${this.apiKey}`;
    this.fallbackRpc = options.fallbackRpc || process.env.ETHEREUM_RPC_URL || 'https://cloudflare-eth.com';
    this.timeoutMs = options.timeoutMs || 8000;
    this.maxRetries = options.maxRetries || 3;
    this.chain = 'Ethereum';
    this.expectedChainId = 1;
  }

  async _rpcCall(method, params = [], useFallback = false) {
    const url = useFallback ? this.fallbackRpc : this.endpoint;
    let attempt = 0;
    let delay = 300;

    while (attempt < this.maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'CYBER-TRACE-Forensics/2.0'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now() + attempt,
            method,
            params
          })
        });

        clearTimeout(timer);

        if (res.status === 429) {
          // Rate limited: backoff
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }

        if (!res.ok) {
          throw new Error(`RPC HTTP ${res.status}: ${res.statusText}`);
        }

        const json = await res.json();
        if (json.error) {
          throw new Error(`RPC Error [${json.error.code}]: ${json.error.message}`);
        }

        return json.result;
      } catch (err) {
        clearTimeout(timer);
        if (attempt >= this.maxRetries) {
          if (!useFallback && this.fallbackRpc) {
            return await this._rpcCall(method, params, true);
          }
          throw err;
        }
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  /**
   * Validates Ethereum Chain ID (Must be 1 for Mainnet)
   */
  async getChainId() {
    const hex = await this._rpcCall('eth_chainId');
    const chainId = parseInt(hex, 16);
    if (chainId !== this.expectedChainId) {
      throw new Error(`Chain ID mismatch: expected ${this.expectedChainId} (Ethereum Mainnet), received ${chainId}`);
    }
    return chainId;
  }

  /**
   * Retrieves the latest mined block number
   */
  async getLatestBlock() {
    const hex = await this._rpcCall('eth_blockNumber');
    return parseInt(hex, 16);
  }

  /**
   * Retrieves native ETH balance for any address in Wei and Ether
   */
  async getBalance(address) {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
      throw new TypeError(`Invalid Ethereum address: ${address}`);
    }
    const clean = address.trim();
    const weiHex = await this._rpcCall('eth_getBalance', [clean, 'latest']);
    const wei = BigInt(weiHex || '0x0');
    return {
      address: clean,
      chain: 'Ethereum',
      wei: wei.toString(),
      ether: Number(wei) / 1e18,
      formatted: `${(Number(wei) / 1e18).toFixed(6)} ETH`
    };
  }

  /**
   * Retrieves transaction by hash with full decoding
   */
  async getTransaction(txHash) {
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())) {
      throw new TypeError(`Invalid Ethereum transaction hash: ${txHash}`);
    }
    const clean = txHash.trim();
    const tx = await this._rpcCall('eth_getTransactionByHash', [clean]);
    if (!tx) return null;

    const blockNum = tx.blockNumber ? parseInt(tx.blockNumber, 16) : null;
    const valueWei = tx.value ? BigInt(tx.value) : 0n;
    const gasPriceGwei = tx.gasPrice ? Number(BigInt(tx.gasPrice)) / 1e9 : 0;

    return {
      hash: tx.hash,
      chain: 'Ethereum',
      blockNumber: blockNum,
      blockHash: tx.blockHash,
      from: tx.from?.toLowerCase(),
      to: tx.to ? tx.to.toLowerCase() : null,
      valueWei: valueWei.toString(),
      valueEther: Number(valueWei) / 1e18,
      nonce: parseInt(tx.nonce, 16),
      gasPriceGwei,
      gasLimit: parseInt(tx.gas, 16),
      input: tx.input,
      isContractCreation: !tx.to
    };
  }

  /**
   * Retrieves transaction receipt for confirmation status and execution logs
   */
  async getTransactionReceipt(txHash) {
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())) return null;
    const clean = txHash.trim();
    const receipt = await this._rpcCall('eth_getTransactionReceipt', [clean]);
    if (!receipt) return null;

    const statusSuccess = receipt.status === '0x1';
    const gasUsed = receipt.gasUsed ? parseInt(receipt.gasUsed, 16) : 0;
    const effectiveGasPrice = receipt.effectiveGasPrice ? BigInt(receipt.effectiveGasPrice) : 0n;
    const feeWei = BigInt(gasUsed) * effectiveGasPrice;

    return {
      hash: receipt.transactionHash,
      status: statusSuccess ? 'SUCCESS' : 'REVERTED',
      isSuccess: statusSuccess,
      blockNumber: parseInt(receipt.blockNumber, 16),
      gasUsed,
      effectiveGasPriceGwei: Number(effectiveGasPrice) / 1e9,
      txFeeEther: Number(feeWei) / 1e18,
      contractAddress: receipt.contractAddress || null,
      logsCount: (receipt.logs || []).length,
      logs: receipt.logs || []
    };
  }

  /**
   * Alchemy Enhanced API: Indexed Asset Transfers
   * Retrieves native ETH, ERC-20, ERC-721, and ERC-1155 transfers for any wallet address
   */
  async getAssetTransfers(options = {}) {
    const {
      fromAddress,
      toAddress,
      fromBlock = '0x0',
      toBlock = 'latest',
      category = ['external', 'erc20'],
      order = 'desc',
      maxCount = 25,
      pageKey
    } = options;

    const params = {
      fromBlock,
      toBlock,
      category,
      order,
      maxCount: `0x${Math.min(100, maxCount).toString(16)}`,
      withMetadata: true,
      excludeZeroValue: true
    };

    if (fromAddress) params.fromAddress = fromAddress.trim();
    if (toAddress) params.toAddress = toAddress.trim();
    if (pageKey) params.pageKey = pageKey;

    try {
      const res = await this._rpcCall('alchemy_getAssetTransfers', [params]);
      const rawTransfers = res?.transfers || [];

      const normalized = rawTransfers.map(t => {
        const decimal = t.rawContract?.decimal ? parseInt(t.rawContract.decimal, 16) : 18;
        return {
          uniqueId: t.uniqueId,
          hash: t.hash,
          from: t.from?.toLowerCase() || '0x0',
          to: t.to ? t.to.toLowerCase() : '0x0',
          amount: Number(t.value || 0),
          asset: t.asset || 'ETH',
          category: t.category, // 'external' | 'internal' | 'erc20' | 'erc721' | 'erc1155'
          blockNumber: t.blockNum ? parseInt(t.blockNum, 16) : null,
          timestamp: t.metadata?.blockTimestamp || new Date().toISOString(),
          contractAddress: t.rawContract?.address?.toLowerCase() || null,
          decimals: decimal,
          chain: 'Ethereum',
          provider: 'Alchemy Ethereum Mainnet'
        };
      });

      return {
        transfers: normalized,
        pageKey: res?.pageKey || null,
        totalRetrieved: normalized.length
      };
    } catch (err) {
      console.warn('alchemy_getAssetTransfers failed or not supported:', err.message);
      return { transfers: [], pageKey: null, totalRetrieved: 0, error: err.message };
    }
  }

  /**
   * Retrieves all historical incoming & outgoing transfers for an address
   */
  async getAddressHistoricalTransfers(address, limit = 50) {
    const clean = address.trim().toLowerCase();
    const [inbound, outbound] = await Promise.all([
      this.getAssetTransfers({ toAddress: clean, maxCount: limit, category: ['external', 'erc20'] }),
      this.getAssetTransfers({ fromAddress: clean, maxCount: limit, category: ['external', 'erc20'] })
    ]);

    const combined = [...(inbound.transfers || []), ...(outbound.transfers || [])];
    // Deduplicate by unique hash + transfer uniqueId
    const seen = new Set();
    const unique = [];
    for (const tx of combined) {
      const key = `${tx.hash}-${tx.uniqueId || tx.from}-${tx.to}-${tx.amount}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(tx);
      }
    }

    // Sort chronologically descending
    unique.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return unique.slice(0, limit);
  }

  /**
   * Health check monitoring endpoint
   */
  async health() {
    try {
      const block = await this.getLatestBlock();
      const chainId = await this.getChainId();
      return {
        provider: 'Alchemy Ethereum Mainnet',
        connected: true,
        chainId,
        latestBlock: block,
        status: 'ONLINE'
      };
    } catch (err) {
      return {
        provider: 'Alchemy Ethereum Mainnet',
        connected: false,
        error: err.message,
        status: 'OFFLINE'
      };
    }
  }
}

export const ethereumAlchemy = new EthereumAlchemyAdapter();

