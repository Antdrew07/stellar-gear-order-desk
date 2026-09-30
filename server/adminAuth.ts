import { createHash, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ADMIN_DASHBOARD_SESSION_HEADER } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";

export const ADMIN_SESSION_COOKIE = "stellar_gear_admin_session";
const ADMIN_SCOPE = "stellar-gear-admin";
const SESSION_SECONDS = 60 * 60 * 12;

function signingKey() {
  if (!ENV.cookieSecret) throw new Error("Admin sessions are unavailable because the platform signing secret is missing.");
  return new TextEncoder().encode(ENV.cookieSecret);
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function credentialsMatch(actual: string, expected: string) {
  return timingSafeEqual(digest(actual), digest(expected));
}

export function adminCredentialsConfigured() {
  return Boolean(ENV.adminDashboardUsername && ENV.adminDashboardPassword);
}

export async function validateAdminCredentials(username: string, password: string) {
  if (!adminCredentialsConfigured()) return false;
  return credentialsMatch(username, ENV.adminDashboardUsername) && credentialsMatch(password, ENV.adminDashboardPassword);
}

async function createAdminSession(username: string) {
  return new SignJWT({ scope: ADMIN_SCOPE, username })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + SESSION_SECONDS)
    .sign(signingKey());
}

export async function hasAdminSession(req: Request) {
  const headerValue = req.headers[ADMIN_DASHBOARD_SESSION_HEADER];
  const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const token = parseCookieHeader(req.headers.cookie ?? "")[ADMIN_SESSION_COOKIE] ?? headerToken;
  if (!token || !ENV.adminDashboardUsername) return false;
  try {
    const { payload } = await jwtVerify(token, signingKey(), { algorithms: ["HS256"] });
    return payload.scope === ADMIN_SCOPE && payload.username === ENV.adminDashboardUsername;
  } catch {
    return false;
  }
}

export async function establishAdminSession(res: Response, username: string) {
  const token = await createAdminSession(username);
  res.cookie(ADMIN_SESSION_COOKIE, token, { ...getSessionCookieOptions(), maxAge: SESSION_SECONDS * 1000 });
  return token;
}

export function clearAdminSession(res: Response) {
  res.clearCookie(ADMIN_SESSION_COOKIE, { ...getSessionCookieOptions(), maxAge: -1 });
}
