/**
 * Google OAuth (OIDC) — substitui o callback Manus.
 * Fluxo: GET /api/oauth/google → 302 Google (state + PKCE) →
 * GET /api/oauth/google/callback → valida → troca code → verifica id_token
 * (JWKS Google) → upsert user (openId "google:<sub>") → sessão própria → 302 /.
 */
import { createHash, randomBytes } from "crypto";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { signSession } from "./session";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_SCOPES = "openid email profile";

/** Cookie efémero do fluxo (state + PKCE verifier). Nome sem prefixo __Host- para funcionar em http://localhost. */
export const OAUTH_FLOW_COOKIE = "fateflow_oauth_state";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };

export function getGoogleConfig(): GoogleConfig | null {
  if (!ENV.googleClientId || !ENV.googleClientSecret || !ENV.appUrl) return null;
  return {
    clientId: ENV.googleClientId,
    clientSecret: ENV.googleClientSecret,
    redirectUri: `${ENV.appUrl}/api/oauth/google/callback`,
  };
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newCodeVerifier(): string {
  return base64url(randomBytes(32)); // 43 chars
}

export function codeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}

export function buildGoogleAuthUrl(config: GoogleConfig, state: string, challenge: string): string {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function flowCookieOptions(maxAge: number) {
  const base = getSessionCookieOptions({} as Request);
  return { ...base, path: "/api/oauth", maxAge };
}

/** Serializador Set-Cookie mínimo (evita quirk de tipos do pacote cookie). */
function serializeFlowCookie(value: string, maxAge: number): string {
  const opts = flowCookieOptions(maxAge);
  const parts = [`${OAUTH_FLOW_COOKIE}=${value}`, `Path=${opts.path}`, `Max-Age=${maxAge}`];
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite === "none" ? "None" : "Lax"}`);
  return parts.join("; ");
}

function setFlowCookie(res: Response, state: string, verifier: string): void {
  res.setHeader("Set-Cookie", serializeFlowCookie(encodeURIComponent(JSON.stringify({ state, verifier })), 600));
}

export function parseFlowCookie(req: Request): { state: string; verifier: string } | null {
  const raw = (req.headers.cookie ?? "").split(";").map((s) => s.trim()).find((s) => s.startsWith(`${OAUTH_FLOW_COOKIE}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw.slice(OAUTH_FLOW_COOKIE.length + 1))) as { state?: unknown; verifier?: unknown };
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string") return null;
    return { state: parsed.state, verifier: parsed.verifier };
  } catch {
    return null;
  }
}

export type TokenResponse = { id_token?: string; access_token?: string; expires_in?: number };

export async function exchangeCodeForTokens(
  config: GoogleConfig,
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  });
  const resp = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) throw new Error(`Falha na troca do código Google (${resp.status})`);
  return (await resp.json()) as TokenResponse;
}

export type GoogleIdentity = { sub: string; email: string | null; name: string | null };

/** Verifica assinatura/emissor/audience do id_token. `jwks` injetável para testes. */
export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)),
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: clientId,
  });
  const sub = payload.sub;
  if (typeof sub !== "string" || sub.length === 0) throw new Error("id_token sem sub");
  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  return { sub, email, name };
}

export type GoogleAuthOverrides = {
  exchange?: typeof exchangeCodeForTokens;
  verify?: typeof verifyGoogleIdToken;
};

export function registerGoogleAuthRoutes(app: Express, overrides: GoogleAuthOverrides = {}): void {
  const exchange = overrides.exchange ?? exchangeCodeForTokens;
  const verify = overrides.verify ?? verifyGoogleIdToken;
  app.get("/api/oauth/google", (req: Request, res: Response) => {
    const config = getGoogleConfig();
    if (!config) {
      res.status(503).json({ error: "Login Google não configurado (GOOGLE_CLIENT_ID/SECRET/APP_URL)" });
      return;
    }
    const state = base64url(randomBytes(16));
    const verifier = newCodeVerifier();
    setFlowCookie(res, state, verifier);
    res.redirect(302, buildGoogleAuthUrl(config, state, codeChallenge(verifier)));
  });

  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const config = getGoogleConfig();
    if (!config) {
      res.status(503).json({ error: "Login Google não configurado (GOOGLE_CLIENT_ID/SECRET/APP_URL)" });
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const flow = parseFlowCookie(req);
    res.setHeader("Set-Cookie", serializeFlowCookie("", -1));
    if (!code || !state || !flow || state !== flow.state) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    try {
      const tokens = await exchange(config, code, flow.verifier);
      if (!tokens.id_token) throw new Error("Resposta Google sem id_token");
      const identity = await verify(tokens.id_token, config.clientId);
      const openId = `google:${identity.sub}`;
      await db.upsertUser({
        openId,
        name: identity.name,
        email: identity.email,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });
      const session = await signSession({ openId, name: identity.name ?? "" });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, session, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] callback falhou:", error instanceof Error ? error.message : error);
      res.status(502).json({ error: "Falha na autenticação Google" });
    }
  });
}
