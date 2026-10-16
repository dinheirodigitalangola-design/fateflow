/**
 * Validação sem MySQL live (Docker indisponível, sem DATABASE_URL):
 * - fake MySQL em memória com where compilado pelo dialeto real;
 * - prova seed idempotente, clamp, migrate max() e isolamento entre 2 utilizadores;
 * - prova wiring tRPC com utilizador autenticado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_ROUTES, CATALOG_WORKS } from "../shared/fateflowCatalog";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createFakeMysql, type FakeMysql } from "./fakeMysql";

vi.mock("./db", () => ({
  getDb: () => Promise.resolve((globalThis as unknown as { __fake: FakeMysql }).__fake.db),
  upsertUser: async () => {},
  getUserByOpenId: async () => undefined,
}));

import { getUserPreferences, getUserProgressMap, listActivity, migrateLocalProgress, setWorkProgress, updateUserPreferences } from "./fateflowDb";
import { seedFateFlow } from "./fateflowSeed";

let fake: FakeMysql;
beforeEach(() => {
  fake = createFakeMysql();
  (globalThis as unknown as { __fake: FakeMysql }).__fake = fake;
});

function userCtx(id: number): TrpcContext {
  return {
    user: {
      id,
      openId: `test-user-${id}`,
      email: `u${id}@example.com`,
      name: `User ${id}`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const EXPECTED_EPISODES = CATALOG_WORKS.reduce((s, w) => s + w.episodes, 0); // 150
const EXPECTED_ROUTE_ITEMS = CATALOG_ROUTES.reduce((s, r) => s + r.workSlugs.length, 0); // 5+4+2+15

describe("seed idempotente (2 execuções, sem deletes)", () => {
  it("cria 15 works / N episódios / 4 rotas / 26 itens e repete sem duplicar", async () => {
    const r1 = await seedFateFlow();
    expect(r1).toEqual({ works: 15, routes: 4, franchises: 1 });
    expect(fake.store.works).toHaveLength(15);
    expect(fake.store.episodes).toHaveLength(EXPECTED_EPISODES);
    expect(fake.store.routes).toHaveLength(4);
    expect(fake.store.route_items).toHaveLength(EXPECTED_ROUTE_ITEMS);
    expect(fake.stats.deletes).toBe(0);

    const snapshot = JSON.stringify(fake.store);
    const r2 = await seedFateFlow();
    expect(r2).toEqual({ works: 15, routes: 4, franchises: 1 });
    expect(JSON.stringify(fake.store)).toBe(snapshot);
    expect(fake.stats.deletes).toBe(0);
  });

  it("normaliza as 15 obras do MVP com campos corretos", async () => {
    await seedFateFlow();
    const bySlug = new Map(fake.store.works.map((w) => [w.slug, w]));
    expect(bySlug.get("ubw")?.episodeCount).toBe(26);
    expect((bySlug.get("ubw") as { orderIndex: number }).orderIndex).toBe(1);
    expect(bySlug.get("zero")?.episodeCount).toBe(25);
    expect(bySlug.get("babylonia")?.episodeCount).toBe(21);
    // episódios genéricos 1..N por obra
    const ubwId = (bySlug.get("ubw") as { id: number }).id;
    const ubwEps = fake.store.episodes.filter((e) => e.workId === ubwId);
    expect(ubwEps).toHaveLength(26);
    expect(ubwEps.map((e) => e.episodeNumber).sort((a, b) => Number(a) - Number(b))[25]).toBe(26);
  });
});

describe("progresso com clamp + histórico server-side", () => {
  it("corta acima do total, marca concluído e regista atividade", async () => {
    await seedFateFlow();
    const res = await setWorkProgress(7, "ubw", 99);
    expect(res).toMatchObject({ slug: "ubw", watchedEpisodes: 26, status: "concluido" });
    const row = fake.store.user_progress.find((r) => r.userId === 7);
    expect(row?.watchedEpisodes).toBe(26);
    expect(row?.completedAt).toBeTruthy();
    expect(fake.store.activity_log.filter((a) => a.actionType === "work_completed")).toHaveLength(1);
  });

  it("reset regista work_reset", async () => {
    await seedFateFlow();
    await setWorkProgress(7, "ubw", 10);
    await setWorkProgress(7, "ubw", 0);
    expect(fake.store.activity_log.filter((a) => a.actionType === "work_reset")).toHaveLength(1);
  });
});

describe("migração localStorage -> conta (max com clamp)", () => {
  it("mantém o maior valor e limita ao total", async () => {
    await seedFateFlow();
    await setWorkProgress(9, "ubw", 20); // já visto na conta
    const res = await migrateLocalProgress(9, { ubw: 14, hf1: 1, zero: 999 });
    expect(res.migrated).toBe(2); // hf1 + zero (ubw da conta vence)
    const map = await getUserProgressMap(9);
    expect(map.ubw).toBe(20);
    expect(map.hf1).toBe(1);
    expect(map.zero).toBe(25); // clamp
    expect(fake.store.activity_log.some((a) => a.actionType === "progress_migrated")).toBe(true);
  });
});

describe("isolamento entre 2 utilizadores (2 browsers)", () => {
  it("progresso, atividade e preferências não vazam entre contas", async () => {
    await seedFateFlow();
    await setWorkProgress(101, "ubw", 10);
    await setWorkProgress(102, "ubw", 3);
    await updateUserPreferences(101, { compactMode: true });

    expect(await getUserProgressMap(101)).toMatchObject({ ubw: 10 });
    expect(await getUserProgressMap(102)).toMatchObject({ ubw: 3 });

    const actA = await listActivity(101);
    const actB = await listActivity(102);
    expect(actA.length).toBeGreaterThan(0);
    expect(actA.every((a) => a.userId === 101)).toBe(true);
    expect(actB.every((a) => a.userId === 102)).toBe(true);

    // limpar atividade de A não toca em B
    const { clearActivity } = await import("./fateflowDb");
    await clearActivity(101);
    expect((await listActivity(101)).length).toBe(0);
    expect((await listActivity(102)).length).toBe(actB.length);
    expect(await getUserProgressMap(102)).toMatchObject({ ubw: 3 });

    expect((await getUserPreferences(101)).compactMode).toBe(true);
    expect((await getUserPreferences(102)).compactMode).toBe(false);
  });
});

describe("wiring tRPC autenticado (com DB mockada)", () => {
  it("markEpisode -> list, preferences roundtrip, routes.setActive, catalog do backend", async () => {
    await seedFateFlow();
    const caller = appRouter.createCaller(userCtx(201));

    const marked = await caller.progress.markEpisode({ workSlug: "prisma", watchedEpisodes: 4 });
    expect(marked).toMatchObject({ slug: "prisma", watchedEpisodes: 4, status: "progresso" });
    expect(await caller.progress.list()).toMatchObject({ prisma: 4 });

    await caller.preferences.update({ compactMode: true });
    expect((await caller.preferences.get()).compactMode).toBe(true);

    const routesList = await caller.routes.list();
    expect(routesList.length).toBe(4);
    const fuyuki = routesList.find((r) => r.slug === "fuyuki");
    expect(fuyuki?.items.length).toBe(5);
    await caller.routes.setActive({ routeId: fuyuki!.id });
    expect((await caller.routes.getActive()).active?.slug).toBe("fuyuki");

    const catalog = await caller.catalog.list();
    expect(catalog.length).toBe(15); // veio da "DB", não do fallback
    const hist = await caller.activity.list({ limit: 50 });
    expect(hist.length).toBeGreaterThan(0);
    await caller.activity.clear();
    expect(await caller.activity.list({ limit: 50 })).toHaveLength(0);
    // progresso sobrevive à limpeza do histórico
    expect(await caller.progress.list()).toMatchObject({ prisma: 4 });
  });
});
