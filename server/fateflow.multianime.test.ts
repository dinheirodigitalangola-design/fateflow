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
    expect((await caller.catalog.list({ franchiseSlug: "fate" })).length).toBe(26);
    expect(await caller.catalog.list({ franchiseSlug: "inexistente" })).toEqual([]);
    const all = await caller.catalog.list(undefined);
    expect(all.length).toBe(26);
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

describe("admin do catálogo", () => {
  function adminCtx(id: number): TrpcContext {
    const base = userCtx(id);
    return { ...base, user: { ...base.user!, role: "admin" as const } };
  }
  const newWork = {
    slug: "test-ova", title: "Test OVA", format: "OVA" as const, universe: "Teste",
    orderIndex: 99, episodeCount: 3, franchiseSlug: "fate",
  };
  it("não-admin e anónimo bloqueados; admin cria/edita/desativa", async () => {
    await seedFateFlow();
    const anon = appRouter.createCaller(anonCtx());
    const user = appRouter.createCaller(userCtx(601));
    const admin = appRouter.createCaller(adminCtx(600));
    await expect(anon.admin.workUpsert(newWork)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(user.admin.workUpsert(newWork)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const created = await admin.admin.workUpsert(newWork);
    expect(created.slug).toBe("test-ova");
    expect(fake.store.works).toHaveLength(27);
    await admin.admin.workUpsert({ ...newWork, title: "Test OVA v2" });
    expect(fake.store.works).toHaveLength(27); // upsert, não duplica
    await admin.admin.workSetActive({ slug: "test-ova", isActive: false });
    expect(fake.store.works.find((w) => w.slug === "test-ova")?.isActive).toBe(false);
    await expect(admin.admin.workUpsert({ ...newWork, slug: "x", franchiseSlug: "fantasma" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("episódios individuais", () => {
  it("marcar/desmarcar atualiza contagem, próximo e histórico", async () => {
    await seedFateFlow();
    const a = appRouter.createCaller(userCtx(501));
    const start = await a.episodes.list({ workSlug: "ubw" });
    expect(start.episodes.length).toBe(26);
    expect(start.watchedCount).toBe(0);
    expect(start.nextEpisode).toBe(1);

    await a.episodes.set({ workSlug: "ubw", episodeNumber: 3, watched: true });
    let cur = await a.episodes.list({ workSlug: "ubw" });
    expect(cur.watchedCount).toBe(1);
    expect(cur.nextEpisode).toBe(1); // o 1 continua por ver
    expect(await a.progress.list()).toMatchObject({ ubw: 1 });

    await a.episodes.set({ workSlug: "ubw", episodeNumber: 1, watched: true });
    await a.episodes.set({ workSlug: "ubw", episodeNumber: 2, watched: true });
    cur = await a.episodes.list({ workSlug: "ubw" });
    expect(cur.watchedCount).toBe(3);
    expect(cur.nextEpisode).toBe(4);

    await a.episodes.set({ workSlug: "ubw", episodeNumber: 2, watched: false });
    cur = await a.episodes.list({ workSlug: "ubw" });
    expect(cur.watchedCount).toBe(2);
    expect(cur.episodes.find((e) => e.episodeNumber === 2)?.watched).toBe(false);
  });

  it("saltar para N marca 1..N e concluir fecha a obra", async () => {
    await seedFateFlow();
    const a = appRouter.createCaller(userCtx(502));
    const jumped = await a.episodes.markUpTo({ workSlug: "ubw", episodeNumber: 10 });
    expect(jumped).toMatchObject({ watchedEpisodes: 10, status: "progresso" });
    const done = await a.episodes.markUpTo({ workSlug: "hf1", episodeNumber: 5 }); // clamp a 1
    expect(done).toMatchObject({ watchedEpisodes: 1, status: "concluido" });
  });

  it("contagem reconcilia linhas individuais e isola users", async () => {
    await seedFateFlow();
    const a = appRouter.createCaller(userCtx(503));
    const b = appRouter.createCaller(userCtx(504));
    await a.progress.markEpisode({ workSlug: "zero", watchedEpisodes: 5 });
    let eps = await a.episodes.list({ workSlug: "zero" });
    expect(eps.episodes.filter((e) => e.watched).map((e) => e.episodeNumber)).toEqual([1, 2, 3, 4, 5]);
    await a.progress.markEpisode({ workSlug: "zero", watchedEpisodes: 2 });
    eps = await a.episodes.list({ workSlug: "zero" });
    expect(eps.episodes.filter((e) => e.watched).map((e) => e.episodeNumber)).toEqual([1, 2]);
    expect((await b.episodes.list({ workSlug: "zero" })).watchedCount).toBe(0);
  });

  it("anónimo rejeitado; episódio inexistente dá NOT_FOUND", async () => {
    await seedFateFlow();
    const anon = appRouter.createCaller(anonCtx());
    await expect(anon.episodes.list({ workSlug: "ubw" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const a = appRouter.createCaller(userCtx(505));
    await expect(a.episodes.set({ workSlug: "ubw", episodeNumber: 99, watched: true })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(a.episodes.list({ workSlug: "fantasma" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("meta pessoal (avaliação, notas, favorito)", () => {
  it("get vazio, update parcial, rating inválido, isolamento", async () => {
    await seedFateFlow();
    const a = appRouter.createCaller(userCtx(701));
    const b = appRouter.createCaller(userCtx(702));
    expect(await a.meta.get({ workSlug: "ubw" })).toMatchObject({ rating: null, notes: null, favorite: false });
    await a.meta.update({ workSlug: "ubw", rating: 5 });
    await a.meta.update({ workSlug: "ubw", notes: "Rever a luta final", favorite: true });
    expect(await a.meta.get({ workSlug: "ubw" })).toMatchObject({ rating: 5, notes: "Rever a luta final", favorite: true });
    expect(fake.store.user_work_meta.filter((r) => r.userId === 701)).toHaveLength(1); // upsert
    await expect(a.meta.update({ workSlug: "ubw", rating: 9 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await b.meta.get({ workSlug: "ubw" })).toMatchObject({ rating: null, favorite: false });
    const anon = appRouter.createCaller(anonCtx());
    await expect(anon.meta.get({ workSlug: "ubw" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
