/**
 * Real Blockchain Transfer Fetcher: "address -> transfers"
 * Fetches real on-chain transfer events across TRON (TRC20 USDT),
 * Ethereum (EVM JSON-RPC / Blockscout API), and Bitcoin (Mempool.space).
 */
export class RealChainAdapter {
  constructor(timeoutMs = 6000) {
    this.timeoutMs = timeoutMs;
  }

  async _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  /**
   * Fetches real TRC-20 transfers (USDT / TRX) from TronGrid
   */
  async fetchTronTransfers(address, limit = 20) {
    const url = `https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?limit=${limit}`;
    try {
      const data = await this._fetchWithTimeout(url);
      if (!data?.data || !Array.isArray(data.data)) return [];

      return data.data.map(tx => {
        const decimals = tx.token_info?.decimals || 6;
        const amount = Number(tx.value) / (10 ** decimals);
        return {
          hash: tx.transaction_id,
          from: tx.from,
          to: tx.to,
          amount,
          token: tx.token_info?.symbol || 'USDT',
          timestamp: new Date(tx.block_timestamp).toISOString(),
          chain: 'TRON'
        };
      });
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetches real Bitcoin transactions from mempool.space API
   */
  async fetchBitcoinTransfers(address) {
    const url = `https://mempool.space/api/address/${encodeURIComponent(address)}/txs`;
    try {
      const data = await this._fetchWithTimeout(url);
      if (!Array.isArray(data)) return [];

      const transfers = [];
      for (const tx of data.slice(0, 15)) {
        const timestamp = tx.status?.block_time
          ? new Date(tx.status.block_time * 1000).toISOString()
          : new Date().toISOString();

        // Calculate inputs sent by this address or outputs received
        for (const out of (tx.vout || [])) {
          if (out.scriptpubkey_address) {
            transfers.push({
              hash: tx.txid,
              from: tx.vin?.[0]?.prevout?.scriptpubkey_address || 'Coinbase/Inputs',
              to: out.scriptpubkey_address,
              amount: (out.value || 0) / 1e8,
              token: 'BTC',
              timestamp,
              chain: 'Bitcoin'
            });
          }
        }
      }
      return transfers;
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetches real Ethereum ERC-20 / ETH transfers from Blockscout Public API
   */
  async fetchEthereumTransfers(address) {
    const url = `https://eth.blockscout.com/api?module=account&action=tokentx&address=${encodeURIComponent(address)}&sort=desc`;
    try {
      const data = await this._fetchWithTimeout(url);
      if (data?.status === '1' && Array.isArray(data.result)) {
        return data.result.slice(0, 20).map(tx => {
          const decimals = Number(tx.tokenDecimal || 18);
          const amount = Number(tx.value) / (10 ** decimals);
          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            amount: isNaN(amount) ? 0 : amount,
            token: tx.tokenSymbol || 'ETH',
            timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
            chain: 'Ethereum'
          };
        });
      }
      return [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Universal router: detects network type and retrieves real transfers
   */
  async fetchTransfers(chain, address) {
    const normChain = (chain || '').toLowerCase();
    if (normChain.includes('tron') || address.startsWith('T')) {
      const tronTx = await this.fetchTronTransfers(address);
      if (tronTx.length) return tronTx;
    }
    if (normChain.includes('bit') || address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1')) {
      const btcTx = await this.fetchBitcoinTransfers(address);
      if (btcTx.length) return btcTx;
    }
    if (normChain.includes('eth') || normChain.includes('polygon') || address.startsWith('0x')) {
      const ethTx = await this.fetchEthereumTransfers(address);
      if (ethTx.length) return ethTx;
    }
    return [];
  }
}

export const chainAdapter = new RealChainAdapter();
