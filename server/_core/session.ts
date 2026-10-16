/**
 * Sessões FateFlow — JWT HS256 próprio, sem dependência Manus.
 * Payload mínimo: { openId, name }. O segredo (SESSION_SECRET) delimita o
 * ambiente: só quem tem o segredo emite/aceita sessões.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export type SessionIdentity = { openId: string; name: string };

function getSecretKey(): Uint8Array {
  const secret = ENV.sessionSecret;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET em falta ou curto (mín. 32 caracteres)");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  identity: SessionIdentity,
  options: { expiresInMs?: number } = {},
): Promise<string> {
  const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({ openId: identity.openId, name: identity.name ?? "" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SessionIdentity | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const { openId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || openId.length === 0) return null;
    if (typeof name !== "string") return null;
    return { openId, name };
  } catch {
    return null;
  }
}

function readSessionToken(req: Request): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const fromCookie = cookies[COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.length > 0) return fromCookie;
  // Fallback p/ header (Preview/WebView que bloqueia cookies third-party).
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

/**
 * Resolve o utilizador autenticado a partir do pedido.
 * Devolve null quando anónimo (o context tRPC trata como público).
 */
export async function authenticateRequest(req: Request): Promise<User | null> {
  let identity: SessionIdentity | null = null;
  try {
    identity = await verifySession(readSessionToken(req));
  } catch {
    identity = null;
  }
  if (!identity) return null;

  const user = await db.getUserByOpenId(identity.openId);
  if (!user) return null;

  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  return (await db.getUserByOpenId(user.openId)) ?? user;
}
