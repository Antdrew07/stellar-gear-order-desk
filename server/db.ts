import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { customAlphabet } from "nanoid";
import {
  catalogSettings,
  InsertProduct,
  orderItems,
  orders,
  products,
  type InsertUser,
  type Order,
  type Product,
  users,
} from "../drizzle/schema";
import { BITCOIN_RECEIVING_ADDRESS, bitcoinPaymentUri, findMatchingBitcoinPayment, formatSatsAsBtc, type BitcoinQuote, usdCentsToSatoshis } from "./bitcoin";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
const FIXED_SHIPPING_CENTS = 2_000;

const seedProducts = [
  { name: "Arc Training Tee", description: "Structured performance tee with a relaxed athletic cut.", category: "Apparel", priceCents: 3200, salePriceCents: 2600, badge: "SALE", featured: true, sortOrder: 10 },
  { name: "Redline Hoodie", description: "Midweight fleece layer built for early starts and late sessions.", category: "Apparel", priceCents: 7200, salePriceCents: null, badge: "FEATURED", featured: true, sortOrder: 20 },
  { name: "Stellar Carry Tote", description: "A durable daily carry for training essentials and recovery gear.", category: "Accessories", priceCents: 3800, salePriceCents: null, badge: null, featured: false, sortOrder: 30 },
  { name: "Forge Lifting Straps", description: "Cotton-blend strap pair with reinforced loop construction.", category: "Training", priceCents: 1800, salePriceCents: null, badge: null, featured: false, sortOrder: 40 },
  { name: "Utility Shaker", description: "Leak-resistant 24 oz shaker with a clean, low-profile silhouette.", category: "Accessories", priceCents: 1600, salePriceCents: 1200, badge: "SALE", featured: false, sortOrder: 50 },
  { name: "Summit Cap", description: "Five-panel cap with an adjustable back strap and lightweight feel.", category: "Apparel", priceCents: 2800, salePriceCents: null, badge: null, featured: false, sortOrder: 60 },
] as const;

const orderAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);
const paymentTokenAlphabet = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 32);

export function productIsAvailable(product: Pick<Product, "inStock" | "inventoryQuantity">) {
  return product.inStock && (product.inventoryQuantity === null || product.inventoryQuantity > 0);
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function ensureCatalogSeeded() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existingProduct = await db.select({ id: products.id }).from(products).limit(1);
  if (!existingProduct.length) {
    await db.insert(products).values(seedProducts.map(product => ({ ...product, inStock: true, inventoryQuantity: null })));
  }
  const settings = await db.select().from(catalogSettings).where(eq(catalogSettings.id, 1)).limit(1);
  if (!settings.length) await db.insert(catalogSettings).values({ id: 1, shippingCents: FIXED_SHIPPING_CENTS });
  return db;
}

export async function getCatalog() {
  const db = await ensureCatalogSeeded();
  const [productRows, settingRows] = await Promise.all([
    db.select().from(products).orderBy(products.sortOrder, products.id),
    db.select().from(catalogSettings).where(eq(catalogSettings.id, 1)).limit(1),
  ]);
  return { products: productRows, settings: settingRows[0] };
}

export async function getPublicCatalog() {
  const catalog = await getCatalog();
  return {
    settings: catalog.settings,
    products: catalog.products.map(product => {
      const { inventoryQuantity: _inventoryQuantity, ...publicProduct } = product;
      return { ...publicProduct, inStock: productIsAvailable(product) };
    }),
  };
}

export async function createProduct(input: Omit<InsertProduct, "id" | "createdAt" | "updatedAt" | "sortOrder">) {
  const db = await ensureCatalogSeeded();
  const [{ maxSort }] = await db.select({ maxSort: sql<number>`COALESCE(MAX(${products.sortOrder}), -1)` }).from(products);
  const result = await db.insert(products).values({ ...input, sortOrder: Number(maxSort) + 1 });
  return Number(result[0].insertId);
}

export async function createSection(title: string) {
  return createProduct({
    kind: "section", name: title, description: null, category: "Section",
    priceCents: 0, salePriceCents: null, badge: null, inStock: true,
    inventoryQuantity: null, featured: false,
  });
}

export async function reorderCatalog(ids: number[]) {
  const db = await ensureCatalogSeeded();
  for (let index = 0; index < ids.length; index++) {
    await db.update(products).set({ sortOrder: index }).where(eq(products.id, ids[index]));
  }
}

export async function updateProduct(id: number, input: Partial<Omit<InsertProduct, "id" | "createdAt" | "updatedAt">>) {
  const db = await ensureCatalogSeeded();
  await db.update(products).set(input).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await ensureCatalogSeeded();
  await db.delete(products).where(eq(products.id, id));
}

type SubmittedItem = { productId: number; quantity: number };
type CustomerDetails = {
  customerName: string; email: string; phone: string; address1: string; address2?: string | null;
  city: string; state: string; postalCode: string; notes?: string | null;
};

type PaymentRecord = Pick<Order, "orderNumber" | "subtotalCents" | "shippingCents" | "totalCents" | "paymentStatus" | "paymentToken" | "bitcoinAmountSats" | "bitcoinAddress" | "paymentTxid">;

function checkoutPaymentDetails(order: PaymentRecord) {
  if (!order.paymentToken || order.bitcoinAmountSats === null || !order.bitcoinAddress) throw new Error("Bitcoin payment information is unavailable for this order.");
  return {
    orderNumber: order.orderNumber,
    paymentToken: order.paymentToken,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    paymentStatus: order.paymentStatus,
    bitcoinAddress: order.bitcoinAddress,
    bitcoinAmountSats: order.bitcoinAmountSats,
    bitcoinAmountBtc: formatSatsAsBtc(order.bitcoinAmountSats),
    bitcoinUri: bitcoinPaymentUri(order.bitcoinAddress, order.bitcoinAmountSats),
    paymentTxid: order.paymentTxid,
  };
}

function nextAvailableBitcoinAmount(baseSatoshis: number, usedSatoshis: Set<number>) {
  const initialSuffix = Math.floor(Math.random() * 9_999) + 1;
  for (let offset = 0; offset < 9_999; offset += 1) {
    const suffix = ((initialSuffix + offset - 1) % 9_999) + 1;
    const candidate = baseSatoshis + suffix;
    if (!usedSatoshis.has(candidate)) return candidate;
  }
  throw new Error("Too many pending Bitcoin payments. Please try again in a few minutes.");
}

export async function startBitcoinCheckout(customer: CustomerDetails, submittedItems: SubmittedItem[], quote: BitcoinQuote) {
  const db = await ensureCatalogSeeded();
  const quantities = new Map<number, number>();
  for (const item of submittedItems) {
    if (item.quantity > 0) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  const uniqueItems = [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  const ids = uniqueItems.map(item => item.productId);
  const liveProducts = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  const productMap = new Map(liveProducts.map(product => [product.id, product]));
  const lines = uniqueItems.map(item => {
    const product = productMap.get(item.productId);
    if (!product || product.kind !== "product" || !productIsAvailable(product) || (product.inventoryQuantity !== null && product.inventoryQuantity < item.quantity)) {
      throw new Error("One or more selected products are out of stock.");
    }
    const unitPriceCents = product.salePriceCents ?? product.priceCents;
    return { product, quantity: item.quantity, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity };
  });
  if (!lines.length) throw new Error("Add at least one available item before checking out.");

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const shippingCents = FIXED_SHIPPING_CENTS;
  const totalCents = subtotalCents + shippingCents;
  const baseSatoshis = usdCentsToSatoshis(totalCents, quote.usdPerBitcoinCents);
  const orderNumber = `SG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${orderAlphabet()}`;
  const paymentToken = paymentTokenAlphabet();

  const payment = await db.transaction(async tx => {
    const activePaymentRows = await tx.select({ bitcoinAmountSats: orders.bitcoinAmountSats }).from(orders)
      .where(inArray(orders.paymentStatus, ["awaiting", "received"]));
    const usedSatoshis = new Set(activePaymentRows.flatMap(row => row.bitcoinAmountSats === null ? [] : [Number(row.bitcoinAmountSats)]));
    const bitcoinAmountSats = nextAvailableBitcoinAmount(baseSatoshis, usedSatoshis);

    for (const line of lines) {
      if (line.product.inventoryQuantity === null) continue;
      const [inventoryUpdate] = await tx.update(products)
        .set({ inventoryQuantity: sql`${products.inventoryQuantity} - ${line.quantity}` })
        .where(and(eq(products.id, line.product.id), gte(products.inventoryQuantity, line.quantity)));
      if (Number(inventoryUpdate.affectedRows) !== 1) throw new Error("One or more selected products just sold out.");
    }

    const orderResult = await tx.insert(orders).values({
      orderNumber,
      status: "new",
      ...customer,
      address2: customer.address2 || null,
      notes: customer.notes || null,
      subtotalCents,
      shippingCents,
      totalCents,
      paymentStatus: "awaiting",
      paymentToken,
      bitcoinAmountSats,
      bitcoinRateUsdCents: quote.usdPerBitcoinCents,
      bitcoinAddress: BITCOIN_RECEIVING_ADDRESS,
    });
    const orderId = Number(orderResult[0].insertId);
    await tx.insert(orderItems).values(lines.map(line => ({
      orderId,
      productId: line.product.id,
      productName: line.product.name,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
      lineTotalCents: line.lineTotalCents,
    })));
    return {
      orderNumber,
      paymentToken,
      subtotalCents,
      shippingCents,
      totalCents,
      paymentStatus: "awaiting" as const,
      bitcoinAmountSats,
      bitcoinAddress: BITCOIN_RECEIVING_ADDRESS,
      paymentTxid: null,
    };
  });

  return checkoutPaymentDetails(payment);
}

export async function getBitcoinCheckoutStatus(paymentToken: string) {
  const db = await ensureCatalogSeeded();
  const rows = await db.select({
    id: orders.id,
    orderNumber: orders.orderNumber,
    subtotalCents: orders.subtotalCents,
    shippingCents: orders.shippingCents,
    totalCents: orders.totalCents,
    paymentStatus: orders.paymentStatus,
    paymentToken: orders.paymentToken,
    bitcoinAmountSats: orders.bitcoinAmountSats,
    bitcoinAddress: orders.bitcoinAddress,
    paymentTxid: orders.paymentTxid,
    paymentReceivedAt: orders.paymentReceivedAt,
    paymentConfirmedAt: orders.paymentConfirmedAt,
  }).from(orders).where(eq(orders.paymentToken, paymentToken)).limit(1);
  const order = rows[0];
  if (!order || order.bitcoinAmountSats === null || !order.bitcoinAddress) return null;

  let next: PaymentRecord = order;
  if (order.paymentStatus !== "confirmed") {
    const match = await findMatchingBitcoinPayment(order.bitcoinAddress, Number(order.bitcoinAmountSats));
    if (match) {
      const now = new Date();
      const paymentStatus = match.confirmed ? "confirmed" as const : "received" as const;
      await db.update(orders).set({
        paymentStatus,
        paymentTxid: match.txid,
        paymentReceivedAt: order.paymentReceivedAt ?? now,
        paymentConfirmedAt: match.confirmed ? (order.paymentConfirmedAt ?? now) : order.paymentConfirmedAt,
        status: match.confirmed ? "confirmed" : "reviewing",
      }).where(eq(orders.id, order.id));
      next = { ...order, paymentStatus, paymentTxid: match.txid };
    }
  }
  return checkoutPaymentDetails(next);
}

export async function getOrders() {
  const db = await ensureCatalogSeeded();
  const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt));
  const ids = orderRows.map(order => order.id);
  const itemRows = ids.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids)) : [];
  return orderRows.map(order => ({ ...order, items: itemRows.filter(item => item.orderId === order.id) }));
}

export async function updateOrderStatus(id: number, status: "new" | "reviewing" | "confirmed" | "closed") {
  const db = await ensureCatalogSeeded();
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}
