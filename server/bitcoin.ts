export const BITCOIN_RECEIVING_ADDRESS = "bc1q2nu28522pkqmyy20c6x32fz4evndyxc7lavmn8";
const SATOSHIS_PER_BTC = 100_000_000;
const COINBASE_RATE_URL = "https://api.coinbase.com/v2/exchange-rates?currency=BTC";
const BLOCKSTREAM_API_URL = "https://blockstream.info/api";

export type BitcoinQuote = {
  usdPerBitcoinCents: number;
  quotedAt: Date;
};

type EsploraTransaction = {
  txid: string;
  vout: Array<{ value: number; scriptpubkey_address?: string }>;
  status: { confirmed: boolean };
};

export type BitcoinPaymentMatch = {
  txid: string;
  confirmed: boolean;
};

export function formatSatsAsBtc(satoshis: number) {
  return (satoshis / SATOSHIS_PER_BTC).toFixed(8);
}

export function usdCentsToSatoshis(totalCents: number, usdPerBitcoinCents: number) {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new Error("A positive order total is required.");
  if (!Number.isSafeInteger(usdPerBitcoinCents) || usdPerBitcoinCents <= 0) throw new Error("A valid BTC/USD rate is required.");
  const satoshis = Math.ceil((totalCents * SATOSHIS_PER_BTC) / usdPerBitcoinCents);
  if (!Number.isSafeInteger(satoshis) || satoshis <= 0) throw new Error("Unable to calculate a safe Bitcoin amount.");
  return satoshis;
}

export function bitcoinPaymentUri(address: string, satoshis: number) {
  return `bitcoin:${address}?amount=${formatSatsAsBtc(satoshis)}`;
}

export async function getBitcoinQuote(): Promise<BitcoinQuote> {
  const response = await fetch(COINBASE_RATE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Unable to load the current Bitcoin exchange rate.");
  const payload = await response.json() as { data?: { rates?: Record<string, string> } };
  const usdPerBitcoin = Number(payload.data?.rates?.USD);
  if (!Number.isFinite(usdPerBitcoin) || usdPerBitcoin <= 0) throw new Error("Bitcoin exchange-rate data was invalid.");
  const usdPerBitcoinCents = Math.round(usdPerBitcoin * 100);
  if (!Number.isSafeInteger(usdPerBitcoinCents) || usdPerBitcoinCents <= 0) throw new Error("Bitcoin exchange-rate data was invalid.");
  return { usdPerBitcoinCents, quotedAt: new Date() };
}

export async function findMatchingBitcoinPayment(address: string, expectedSatoshis: number): Promise<BitcoinPaymentMatch | null> {
  const response = await fetch(`${BLOCKSTREAM_API_URL}/address/${encodeURIComponent(address)}/txs`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Unable to check the Bitcoin network right now.");
  const transactions = await response.json() as EsploraTransaction[];
  const matchingTransaction = transactions.find(transaction => transaction.vout.some(output => (
    output.scriptpubkey_address === address && output.value === expectedSatoshis
  )));
  return matchingTransaction ? { txid: matchingTransaction.txid, confirmed: matchingTransaction.status.confirmed } : null;
}
