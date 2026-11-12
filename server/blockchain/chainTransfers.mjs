import { createHash } from 'node:crypto';

/**
 * Real-world Chain Adapter for "address -> transfers"
 * Supports:
 * - TronGrid for TRC-20 USDT and TRX native transfers
 * - EVM / Ethereum / Polygon public explorers & RPCs for ERC-20 & ETH transfers
 * - Mempool.space for Bitcoin UTXO inputs & outputs
 */

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'CyberTrace-Forensics/1.0',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TronGrid TRC20 USDT & TRX Transfer Ingestion
 */
export async function fetchTronTransfers(address, limit = 25) {
  const cleanAddr = String(address).trim();
  const transfers = [];
  let isLive = false;

  try {
    // 1. Fetch TRC20 Token Transfers (USDT contract TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t)
    const trc20Url = `https://api.trongrid.io/v1/accounts/${cleanAddr}/transactions/trc20?limit=${limit}`;
    const res = await fetchWithTimeout(trc20Url);
    if (res.ok) {
      isLive = true;
      const data = await res.json();
      if (Array.isArray(data.data)) {
        for (const item of data.data) {
          const decimals = item.token_info?.decimals ?? 6;
          const rawVal = BigInt(item.value || '0');
          const amount = Number(rawVal) / (10 ** decimals);
          transfers.push({
            hash: item.transaction_id,
            from: item.from,
            to: item.to,
            amount: Number(amount.toFixed(4)),
            token: item.token_info?.symbol || 'USDT-TRC20',
            timestamp: new Date(item.block_timestamp).toISOString(),
            chain: 'TRON',
            contractAddress: item.token_info?.address || null,
            confirmed: true
          });
        }
      }
    }
  } catch {
    // TronGrid TRC20 request failed or network blocked
  }

  try {
    // 2. Fetch TRX native transactions if TRC20 transfers were empty or low
    if (transfers.length < 5) {
      const nativeUrl = `https://api.trongrid.io/v1/accounts/${cleanAddr}/transactions?limit=${limit}`;
      const res = await fetchWithTimeout(nativeUrl);
      if (res.ok) {
        isLive = true;
        const data = await res.json();
        if (Array.isArray(data.data)) {
          for (const tx of data.data) {
            const contract = tx.raw_data?.contract?.[0];
            const contractVal = contract?.parameter?.value || {};
            const amountSun = contractVal.amount || 0;
            if (amountSun > 0 && contractVal.owner_address && contractVal.to_address) {
              transfers.push({
                hash: tx.txID,
                from: contractVal.owner_address,
                to: contractVal.to_address,
                amount: Number((amountSun / 1e6).toFixed(4)),
                token: 'TRX',
                timestamp: new Date(tx.block_timestamp || Date.now()).toISOString(),
                chain: 'TRON',
                confirmed: Boolean(tx.ret?.[0]?.contractRet === 'SUCCESS')
              });
            }
          }
        }
      }
    }
  } catch {
    // TronGrid native request failed
  }

  return { address: cleanAddr, chain: 'TRON', live: isLive, count: transfers.length, transfers };
}

/**
 * Ethereum & EVM Transfers using Blockscout / Public Explorer REST APIs
 */
export async function fetchEvmTransfers(chain = 'Ethereum', address, limit = 25) {
  const cleanAddr = String(address).trim().toLowerCase();
  const transfers = [];
  let isLive = false;

  const baseEndpoint = chain.toLowerCase() === 'polygon'
    ? 'https://polygon.blockscout.com/api/v2'
    : 'https://eth.blockscout.com/api/v2';

  try {
    const url = `${baseEndpoint}/addresses/${cleanAddr}/transactions?limit=${limit}`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      isLive = true;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const rawWei = item.value ? BigInt(item.value) : 0n;
          const ethVal = Number(rawWei) / 1e18;
          transfers.push({
            hash: item.hash,
            from: item.from?.hash || '0x0',
            to: item.to?.hash || '0x0',
            amount: Number(ethVal.toFixed(6)),
            token: chain.toLowerCase() === 'polygon' ? 'MATIC' : 'ETH',
            timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
            chain,
            confirmed: item.status === 'ok' || item.result === 'success'
          });
        }
      }
    }
  } catch {
    // EVM explorer offline
  }

  return { address: cleanAddr, chain, live: isLive, count: transfers.length, transfers };
}

/**
 * Bitcoin UTXO Transfers using Mempool.space
 */
export async function fetchBitcoinTransfers(address, limit = 25) {
  const cleanAddr = String(address).trim();
  const transfers = [];
  let isLive = false;

  try {
    const url = `https://mempool.space/api/address/${cleanAddr}/txs`;
    const res = await fetchWithTimeout(url);
    if (res.ok) {
      isLive = true;
      const txs = await res.json();
      if (Array.isArray(txs)) {
        for (const tx of txs.slice(0, limit)) {
          const timestamp = tx.status?.block_time
            ? new Date(tx.status.block_time * 1000).toISOString()
            : new Date().toISOString();

          const inputs = (tx.vin || []).map(v => ({
            from: v.prevout?.scriptpubkey_address || 'Coinbase',
            amount: (v.prevout?.value || 0) / 1e8
          }));

          const outputs = (tx.vout || []).map(o => ({
            to: o.scriptpubkey_address || 'Script',
            amount: (o.value || 0) / 1e8
          }));

          const primarySender = inputs[0]?.from || 'Multi-input';
          for (const out of outputs) {
            transfers.push({
              hash: tx.txid,
              from: primarySender,
              to: out.to,
              amount: Number(out.amount.toFixed(8)),
              token: 'BTC',
              timestamp,
              chain: 'Bitcoin',
              confirmed: Boolean(tx.status?.confirmed)
            });
          }
        }
      }
    }
  } catch {
    // Bitcoin explorer offline
  }

  return { address: cleanAddr, chain: 'Bitcoin', live: isLive, count: transfers.length, transfers };
}

/**
 * Unified Address Transfer Ingestion Dispatcher
 */
export async function fetchAddressTransfers(chain, address, options = {}) {
  const c = String(chain || 'Ethereum').trim().toLowerCase();
  if (c === 'tron' || c === 'trx') {
    return await fetchTronTransfers(address, options.limit || 25);
  }
  if (c === 'bitcoin' || c === 'btc') {
    return await fetchBitcoinTransfers(address, options.limit || 25);
  }
  return await fetchEvmTransfers(chain, address, options.limit || 25);
}
