import { afterEach, describe, expect, it, vi } from "vitest";
import { bitcoinPaymentUri, findMatchingBitcoinPayment, formatSatsAsBtc, getBitcoinQuote, usdCentsToSatoshis } from "./bitcoin";

afterEach(() => vi.unstubAllGlobals());

describe("Bitcoin payment helpers", () => {
  it("calculates a rounded-up exact satoshi amount and payment URI", () => {
    expect(usdCentsToSatoshis(2_000, 8_000_000)).toBe(25_000);
    expect(formatSatsAsBtc(25_123)).toBe("0.00025123");
    expect(bitcoinPaymentUri("bc1qexample", 25_123)).toBe("bitcoin:bc1qexample?amount=0.00025123");
  });

  it("reads the BTC/USD rate from the public quote response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { rates: { USD: "83510.01" } } }), { status: 200 })));
    await expect(getBitcoinQuote()).resolves.toMatchObject({ usdPerBitcoinCents: 8_351_001 });
  });

  it("recognizes an exact payment output and its confirmation state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { txid: "confirmed-tx", vout: [{ value: 20_000, scriptpubkey_address: "bc1qtest" }], status: { confirmed: true } },
      { txid: "other-tx", vout: [{ value: 30_000, scriptpubkey_address: "bc1qtest" }], status: { confirmed: false } },
    ]), { status: 200 })));
    await expect(findMatchingBitcoinPayment("bc1qtest", 20_000)).resolves.toEqual({ txid: "confirmed-tx", confirmed: true });
  });
});
