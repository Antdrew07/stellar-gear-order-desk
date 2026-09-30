import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { customAlphabet } from "nanoid";
import {
  catalogSettings,
  InsertProduct,
  orderItems,
  orders,
  products,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

const seedProducts = [
  { name: "Arc Training Tee", description: "Structured performance tee with a relaxed athletic cut.", category: "Apparel", priceCents: 3200, salePriceCents: 2600, badge: "SALE", featured: true, sortOrder: 10 },
  { name: "Redline Hoodie", description: "Midweight fleece layer built for early starts and late sessions.", category: "Apparel", priceCents: 7200, salePriceCents: null, badge: "FEATURED", featured: true, sortOrder: 20 },
  { name: "Stellar Carry Tote", description: "A durable daily carry for training essentials and recovery gear.", category: "Accessories", priceCents: 3800, salePriceCents: null, badge: null, featured: false, sortOrder: 30 },
  { name: "Forge Lifting Straps", description: "Cotton-blend strap pair with reinforced loop construction.", category: "Training", priceCents: 1800, salePriceCents: null, badge: null, featured: false, sortOrder: 40 },
  { name: "Utility Shaker", description: "Leak-resistant 24 oz shaker with a clean, low-profile silhouette.", category: "Accessories", priceCents: 1600, salePriceCents: 1200, badge: "SALE", featured: false, sortOrder: 50 },
  { name: "Summit Cap", description: "Five-panel cap with an adjustable back strap and lightweight feel.", category: "Apparel", priceCents: 2800, salePriceCents: null, badge: null, featured: false, sortOrder: 60 },
] as const;

const orderAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

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
    await db.insert(products).values(seedProducts.map(product => ({ ...product, inStock: true })));
  }
  const settings = await db.select().from(catalogSettings).where(eq(catalogSettings.id, 1)).limit(1);
  if (!settings.length) await db.insert(catalogSettings).values({ id: 1, shippingCents: 2000 });
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

export async function createProduct(input: Omit<InsertProduct, "id" | "createdAt" | "updatedAt">) {
  const db = await ensureCatalogSeeded();
  const result = await db.insert(products).values(input);
  return Number(result[0].insertId);
}

export async function updateProduct(id: number, input: Partial<Omit<InsertProduct, "id" | "createdAt" | "updatedAt">>) {
  const db = await ensureCatalogSeeded();
  await db.update(products).set(input).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await ensureCatalogSeeded();
  await db.delete(products).where(eq(products.id, id));
}

export async function updateShipping(shippingCents: number) {
  const db = await ensureCatalogSeeded();
  await db.update(catalogSettings).set({ shippingCents }).where(eq(catalogSettings.id, 1));
}

type SubmittedItem = { productId: number; quantity: number };
type CustomerDetails = {
  customerName: string; email: string; phone: string; address1: string; address2?: string | null;
  city: string; state: string; postalCode: string; notes?: string | null;
};

export async function submitOrder(customer: CustomerDetails, submittedItems: SubmittedItem[]) {
  const db = await ensureCatalogSeeded();
  const uniqueItems = submittedItems.filter(item => item.quantity > 0);
  const ids = [...new Set(uniqueItems.map(item => item.productId))];
  const liveProducts = await db.select().from(products).where(inArray(products.id, ids));
  const productMap = new Map(liveProducts.map(product => [product.id, product]));
  const lines = uniqueItems.map(item => {
    const product = productMap.get(item.productId);
    if (!product || !product.inStock) throw new Error("One or more selected products are no longer available.");
    const unitPriceCents = product.salePriceCents ?? product.priceCents;
    return { product, quantity: item.quantity, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity };
  });
  if (!lines.length) throw new Error("Add at least one available item before submitting your request.");
  const settings = await db.select().from(catalogSettings).where(eq(catalogSettings.id, 1)).limit(1);
  const shippingCents = settings[0]?.shippingCents ?? 2000;
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const totalCents = subtotalCents + shippingCents;
  const orderNumber = `SG-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${orderAlphabet()}`;

  const result = await db.transaction(async tx => {
    const orderResult = await tx.insert(orders).values({
      orderNumber, status: "new", ...customer, address2: customer.address2 || null, notes: customer.notes || null,
      subtotalCents, shippingCents, totalCents,
    });
    const orderId = Number(orderResult[0].insertId);
    await tx.insert(orderItems).values(lines.map(line => ({
      orderId, productId: line.product.id, productName: line.product.name, unitPriceCents: line.unitPriceCents,
      quantity: line.quantity, lineTotalCents: line.lineTotalCents,
    })));
    return { orderId, orderNumber, totalCents };
  });
  return result;
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
