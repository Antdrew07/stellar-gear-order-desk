import { describe, expect, it } from "vitest";
import { productIsAvailable } from "./db";

type AvailabilityProduct = Parameters<typeof productIsAvailable>[0];

const product = (inStock: boolean, inventoryQuantity: number | null): AvailabilityProduct => ({ inStock, inventoryQuantity });

describe("inventory availability", () => {
  it("keeps untracked available items selectable", () => {
    expect(productIsAvailable(product(true, null))).toBe(true);
  });

  it("marks zero inventory and manually hidden items out of stock", () => {
    expect(productIsAvailable(product(true, 0))).toBe(false);
    expect(productIsAvailable(product(false, 12))).toBe(false);
  });

  it("keeps positive tracked inventory available", () => {
    expect(productIsAvailable(product(true, 1))).toBe(true);
  });
});
