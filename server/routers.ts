import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createProduct,
  deleteProduct,
  getCatalog,
  getOrders,
  submitOrder,
  updateOrderStatus,
  updateProduct,
  updateShipping,
} from "./db";

const productInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().min(2).max(80),
  priceCents: z.number().int().min(0).max(2_000_000),
  salePriceCents: z.number().int().min(0).max(2_000_000).nullable().optional(),
  badge: z.string().trim().max(24).nullable().optional(),
  inStock: z.boolean(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: router({
    snapshot: publicProcedure.query(() => getCatalog()),
    create: adminProcedure.input(productInput).mutation(({ input }) => createProduct({
      name: input.name, description: input.description ?? null, category: input.category,
      priceCents: input.priceCents, salePriceCents: input.salePriceCents ?? null, badge: input.badge ?? null,
      inStock: input.inStock, featured: input.featured, sortOrder: input.sortOrder,
    })),
    update: adminProcedure.input(productInput.extend({ id: z.number().int().positive() })).mutation(({ input }) => {
      const { id, ...product } = input;
      return updateProduct(id, { ...product, description: product.description ?? null, salePriceCents: product.salePriceCents ?? null, badge: product.badge ?? null });
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteProduct(input.id)),
    updateShipping: adminProcedure.input(z.object({ shippingCents: z.number().int().min(0).max(100_000) })).mutation(({ input }) => updateShipping(input.shippingCents)),
  }),
  orders: router({
    submit: publicProcedure.input(z.object({
      customer: z.object({
        customerName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320),
        phone: z.string().trim().min(7).max(48), address1: z.string().trim().min(3).max(180),
        address2: z.string().trim().max(180).optional(), city: z.string().trim().min(2).max(100),
        state: z.string().trim().min(2).max(100), postalCode: z.string().trim().min(3).max(32),
        notes: z.string().trim().max(2000).optional(),
      }),
      items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(25) })).min(1),
    })).mutation(({ input }) => submitOrder(input.customer, input.items)),
    list: adminProcedure.query(() => getOrders()),
    updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["new", "reviewing", "confirmed", "closed"]) })).mutation(({ input }) => updateOrderStatus(input.id, input.status)),
  }),
});

export type AppRouter = typeof appRouter;
