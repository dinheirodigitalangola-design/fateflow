import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  buildGoogleAuthUrl,
  codeChallenge,
  exchangeCodeForTokens,
  getGoogleConfig,
  newCodeVerifier,
  OAUTH_FLOW_COOKIE,
  parseFlowCookie,
  registerGoogleAuthRoutes,
  verifyGoogleIdToken,
  type GoogleConfig,
} from "./_core/googleAuth";
import { authenticateRequest, signSession } from "./_core/session";
import { COOKIE_NAME } from "../shared/const";
import { createFakeMysql, type FakeMysql } from "./fakeMysql";

type FakeRef = { __fake: FakeMysql };
function fakeRef(): FakeMysql { return (globalThis as unknown as FakeRef).__fake; }

vi.mock("./db", () => ({
  getDb: () => Promise.resolve(fakeRef().db),
  upsertUser: async (user: Record<string, unknown>) => {
    const fake = fakeRef();
    const existing = fake.store.users.find((u) => u.openId === user.openId);
    if (existing) {
      Object.assign(existing, { ...user, updatedAt: new Date() });
    } else {
      fake.store.users.push({
        id: fake.store.users.length + 1, role: "user", name: null, email: null, loginMethod: null,
        createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), ...user,
      });
    }
  },
  getUserByOpenId: async (openId: string) => {
    const found = fakeRef().store.users.find((u) => u.openId === openId);
    return found ? { ...found } : undefined;
  },
}));

let fake: FakeMysql;
const TEST_ENV = {
  APP_URL: "https://app.test",
  GOOGLE_CLIENT_ID: "test-client-id",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
  SESSION_SECRET: "unit-test-session-secret-never-deployed-123456",
};

beforeEach(() => {
  fake = createFakeMysql();
  (globalThis as unknown as { __fake: FakeMysql }).__fake = fake;
  vi.stubEnv("APP_URL", TEST_ENV.APP_URL);
  vi.stubEnv("GOOGLE_CLIENT_ID", TEST_ENV.GOOGLE_CLIENT_ID);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", TEST_ENV.GOOGLE_CLIENT_SECRET);
  vi.stubEnv("SESSION_SECRET", TEST_ENV.SESSION_SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

function seedUser(openId: string) {
  fake.store.users.push({ id: 1, openId, name: "Test", email: "t@example.com", loginMethod: "google", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() });
}

describe("config Google", () => {
  it("devolve null sem env", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect(getGoogleConfig()).toBeNull();
  });
  it("monta redirect_uri a partir de APP_URL", () => {
    expect(getGoogleConfig()).toMatchObject({
      clientId: "test-client-id",
      redirectUri: "https://app.test/api/oauth/google/callback",
    });
  });
});

describe("PKCE + URL", () => {
  it("verifier tem ≥43 chars e challenge é S256", () => {
    const v = newCodeVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge(v)).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
  it("auth URL contém parâmetros OIDC", () => {
    const url = new URL(buildGoogleAuthUrl({ clientId: "cid", clientSecret: "s", redirectUri: "https://a/b" }, "st", "ch"));
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("openid");
  });
});

describe("parseFlowCookie", () => {
  it("lê state+verifier válidos", () => {
    const req = { headers: { cookie: `${OAUTH_FLOW_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "s", verifier: "v" }))}` } } as never;
    expect(parseFlowCookie(req)).toEqual({ state: "s", verifier: "v" });
  });
  it("rejeita ausente e lixo", () => {
    expect(parseFlowCookie({ headers: {} } as never)).toBeNull();
    expect(parseFlowCookie({ headers: { cookie: `${OAUTH_FLOW_COOKIE}=%%%` } } as never)).toBeNull();
  });
});

describe("verifyGoogleIdToken (JWKS local)", () => {
  async function setup() {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    const jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "k1", alg: "RS256" }] });
    const sign = (claims: Record<string, unknown>) =>
      new SignJWT(claims as never)
        .setProtectedHeader({ alg: "RS256", kid: "k1" })
        .sign(privateKey);
    return { jwks, sign };
  }
  it("aceita id_token válido", async () => {
    const { jwks, sign } = await setup();
    const tok = await sign({ sub: "123", email: "a@b.c", name: "Ana", iss: "https://accounts.google.com", aud: "test-client-id", exp: Math.floor(Date.now() / 1000) + 300 });
    await expect(verifyGoogleIdToken(tok, "test-client-id", jwks)).resolves.toMatchObject({ sub: "123", email: "a@b.c", name: "Ana" });
  });
  it("rejeita audience errada e assinatura adulterada", async () => {
    const { jwks, sign } = await setup();
    const tok = await sign({ sub: "123", iss: "https://accounts.google.com", aud: "outro-client", exp: Math.floor(Date.now() / 1000) + 300 });
    await expect(verifyGoogleIdToken(tok, "test-client-id", jwks)).rejects.toThrow();
    const good = await sign({ sub: "123", iss: "https://accounts.google.com", aud: "test-client-id", exp: Math.floor(Date.now() / 1000) + 300 });
    await expect(verifyGoogleIdToken(`${good.slice(0, -2)}xx`, "test-client-id", jwks)).rejects.toThrow();
  });
});

describe("exchangeCodeForTokens", () => {
  const config: GoogleConfig = { clientId: "cid", clientSecret: "sec", redirectUri: "https://a/b" };
  it("devolve id_token", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id_token: "tok123" }))) as unknown as typeof fetch;
    await expect(exchangeCodeForTokens(config, "code", "ver", fetchImpl)).resolves.toMatchObject({ id_token: "tok123" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it("400 do Google vira erro controlado", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 400 })) as unknown as typeof fetch;
    await expect(exchangeCodeForTokens(config, "code", "ver", fetchImpl)).rejects.toThrow("400");
  });
});

function captureRoutes() {
  const handlers: Record<string, (req: never, res: never) => unknown> = {};
  const app = { get: vi.fn((path: string, h: (req: never, res: never) => unknown) => { handlers[path] = h; }) };
  return { app, handlers };
}

function mockRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((body: unknown) => { res.body = body; return res; });
  res.redirect = vi.fn((code: number, url: string) => { res.redirected = [code, url]; return res; });
  res.cookie = vi.fn(() => res);
  res.setHeader = vi.fn();
  res.clearCookie = vi.fn(() => res);
  return res as unknown as {
    status: (c: number) => unknown; json: (b: unknown) => unknown; redirect: (c: number, u: string) => unknown;
    cookie: (...a: unknown[]) => unknown; setHeader: (...a: unknown[]) => void; statusCode: number; body: unknown; redirected: [number, string];
  };
}

describe("rotas Google", () => {
  it("GET /api/oauth/google sem config → 503", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const { app, handlers } = captureRoutes();
    registerGoogleAuthRoutes(app as never);
    const res = mockRes();
    (handlers["/api/oauth/google"] as (req: never, res: never) => void)({} as never, res as never);
    expect(res.statusCode).toBe(503);
  });

  it("callback válido cria user google:*, sessão e 302 /", async () => {
    const { app, handlers } = captureRoutes();
    registerGoogleAuthRoutes(app as never, {
      exchange: async () => ({ id_token: "tok" }),
      verify: async () => ({ sub: "99", email: "ana@example.com", name: "Ana" }),
    });
    // simula upsert: a rota usa db.upsertUser (mock no-op) — regista-se o user aqui
    // para representar o efeito, e valida-se sessão + cookie + redirect.
    const req = {
      query: { code: "c", state: "s" },
      headers: { cookie: `${OAUTH_FLOW_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "s", verifier: "v" }))}` },
    } as never;
    const res = mockRes();
    await (handlers["/api/oauth/google/callback"] as (req: never, res: never) => Promise<void>)(req, res as never);
    expect(res.redirected).toEqual([302, "/"]);
    const created = fake.store.users.find((u) => u.openId === "google:99");
    expect(created).toMatchObject({ email: "ana@example.com", name: "Ana", loginMethod: "google" });
    const cookieCall = (res.cookie as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
    expect(cookieCall[0]).toBe(COOKIE_NAME);
    expect(typeof cookieCall[1]).toBe("string");
  });

  it("callback com state errado → 403", async () => {
    const { app, handlers } = captureRoutes();
    registerGoogleAuthRoutes(app as never, {
      exchange: async () => ({ id_token: "tok" }),
      verify: async () => ({ sub: "99", email: null, name: null }),
    });
    const req = {
      query: { code: "c", state: "FORJADO" },
      headers: { cookie: `${OAUTH_FLOW_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "s", verifier: "v" }))}` },
    } as never;
    const res = mockRes();
    await (handlers["/api/oauth/google/callback"] as (req: never, res: never) => Promise<void>)(req, res as never);
    expect(res.statusCode).toBe(403);
  });
});

describe("authenticateRequest com sessão própria", () => {
  it("cookie válido resolve o user; token mau e desconhecido → null", async () => {
    seedUser("google:99");
    const token = await signSession({ openId: "google:99", name: "Ana" });
    const ok = await authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${token}` } } as never);
    expect(ok?.openId).toBe("google:99");
    expect(await authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=lixo` } } as never)).toBeNull();
    const ghost = await signSession({ openId: "google:fantasma", name: "X" });
    expect(await authenticateRequest({ headers: { cookie: `${COOKIE_NAME}=${ghost}` } } as never)).toBeNull();
  });
});
