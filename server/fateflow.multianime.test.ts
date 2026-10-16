/**
 * Multi-anime readiness: franquias, biblioteca pessoal e reset total.
 * Usa a mesma fake MySQL (where compilado pelo dialeto real).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createFakeMysql, type FakeMysql } from "./fakeMysql";

vi.mock("./db", () => ({
  getDb: () => Promise.resolve((globalThis as unknown as { __fake: FakeMysql }).__fake.db),
  upsertUser: async () => {},
  getUserByOpenId: async () => undefined,
}));

import { seedFateFlow } from "./fateflowSeed";

let fake: FakeMysql;
beforeEach(() => {
  fake = createFakeMysql();
  (globalThis as unknown as { __fake: FakeMysql }).__fake = fake;
});

function anonCtx(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function userCtx(id: number): TrpcContext {
  return {
    user: {
      id, openId: `test-user-${id}`, email: `u${id}@example.com`, name: `User ${id}`,
      loginMethod: "google", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}

describe("franquias (Fate é a 1ª de N)", () => {
  it("seed cria a franquia fate e liga obras + rotas, sem duplicar", async () => {
    await seedFateFlow();
    expect(fake.store.franchises).toHaveLength(1);
    expect(fake.store.franchises[0]).toMatchObject({ slug: "fate", name: "Fate" });
    const fateId = fake.store.franchises[0]?.id;
    expect(fake.store.works.every((w) => w.franchiseId === fateId)).toBe(true);
    expect(fake.store.routes.every((r) => r.franchiseId === fateId)).toBe(true);
    const snapshot = JSON.stringify(fake.store);
    await seedFateFlow();
    expect(JSON.stringify(fake.store)).toBe(snapshot);
  });

  it("franchises.list público + catalog filtrável por franquia", async () => {
    await seedFateFlow();
    const caller = appRouter.createCaller(anonCtx());
    const fr = await caller.franchises.list();
    expect(fr.map((f) => f.slug)).toEqual(["fate"]);
    expect((await caller.catalog.list({ franchiseSlug: "fate" })).length).toBe(15);
    expect(await caller.catalog.list({ franchiseSlug: "inexistente" })).toEqual([]);
    const all = await caller.catalog.list(undefined);
    expect(all.length).toBe(15);
    expect(all.every((w) => (w as { franchiseSlug?: string | null }).franchiseSlug === "fate")).toBe(true);
  });
});

describe("biblioteca pessoal (escolher animes p/ acompanhar)", () => {
  it("anónimo rejeitado; add/remove/list com isolamento", async () => {
    await seedFateFlow();
    const anon = appRouter.createCaller(anonCtx());
    await expect(anon.library.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    const a = appRouter.createCaller(userCtx(301));
    const b = appRouter.createCaller(userCtx(302));
    await a.library.add({ workSlug: "ubw" });
    await a.library.add({ workSlug: "prisma" });
    await a.library.add({ workSlug: "ubw" }); // idempotente
    expect((await a.library.list()).length).toBe(2);
    expect((await b.library.list()).length).toBe(0);
    await a.library.remove({ workSlug: "ubw" });
    expect((await a.library.list()).map((e) => e.work?.slug)).toEqual(["prisma"]);
    await expect(a.library.add({ workSlug: "fantasma" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("Lote A — reset total", () => {
  it("resetAll limpa progresso + histórico só do próprio user", async () => {
    await seedFateFlow();
    const a = appRouter.createCaller(userCtx(401));
    const b = appRouter.createCaller(userCtx(402));
    await a.progress.markEpisode({ workSlug: "ubw", watchedEpisodes: 5 });
    await b.progress.markEpisode({ workSlug: "ubw", watchedEpisodes: 7 });
    const res = await a.progress.resetAll();
    expect(res.resetWorks).toBe(1);
    expect(await a.progress.list()).toEqual({});
    expect(await a.activity.list({ limit: 50 })).toEqual([]);
    expect(await b.progress.list()).toMatchObject({ ubw: 7 });
  });
});
