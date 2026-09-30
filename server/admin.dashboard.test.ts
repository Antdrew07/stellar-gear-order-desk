import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { ADMIN_SESSION_COOKIE, hasAdminSession } from "./adminAuth";
import { ADMIN_DASHBOARD_SESSION_HEADER } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; value?: string; options: Record<string, unknown> };

function createContext(isDashboardAdmin = false) {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    isDashboardAdmin,
    req: { headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: (name: string, options: Record<string, unknown>) => cookies.push({ name, options }),
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

afterEach(() => vi.unstubAllEnvs());

describe("admin dashboard access", () => {
  it("requires an admin dashboard session before catalog changes", async () => {
    const { ctx } = createContext(false);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.catalog.remove({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects catalog writes without an inventory count", async () => {
    const { ctx } = createContext(true);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.catalog.create({
      name: "Inventory test item",
      description: null,
      category: "General",
      priceCents: 2500,
      salePriceCents: null,
      badge: null,
      inStock: true,
      inventoryQuantity: null,
      featured: false,
      sortOrder: 100,
    } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("sets a secure, HTTP-only admin session cookie after valid credentials", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_USERNAME", "inventory-admin");
    vi.stubEnv("ADMIN_DASHBOARD_PASSWORD", "unit-test-password");
    vi.stubEnv("MANUS_JWT_SECRET", "unit-test-signing-key-never-deployed");
    const { ctx, cookies } = createContext(false);
    const result = await appRouter.createCaller(ctx).admin.login({ username: "inventory-admin", password: "unit-test-password" });
    expect(result).toMatchObject({ signedIn: true, sessionToken: expect.any(String) });
    expect(cookies[0]).toMatchObject({ name: ADMIN_SESSION_COOKIE, options: { secure: true, httpOnly: true, sameSite: "none", path: "/" } });
    expect(cookies[0]?.value).toEqual(expect.any(String));
    await expect(hasAdminSession({ headers: { [ADMIN_DASHBOARD_SESSION_HEADER]: result.sessionToken } } as unknown as TrpcContext["req"])).resolves.toBe(true);
  });

  it("rejects invalid dashboard credentials", async () => {
    vi.stubEnv("ADMIN_DASHBOARD_USERNAME", "inventory-admin");
    vi.stubEnv("ADMIN_DASHBOARD_PASSWORD", "unit-test-password");
    const { ctx } = createContext(false);
    await expect(appRouter.createCaller(ctx).admin.login({ username: "inventory-admin", password: "incorrect" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
