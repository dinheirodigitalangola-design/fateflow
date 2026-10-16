import { describe, expect, it } from "vitest";
import { CATALOG_ROUTES, CATALOG_WORKS, clampWatched, overallProgress, recommend, statusFor } from "../shared/fateflowCatalog";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonCtx(): TrpcContext {
  return { user: null, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

function userCtx(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "test-user",
      email: "test@example.com",
      name: "Test",
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

describe("FateFlow Fase 1 — catálogo normalizado (26 obras)", () => {
  it("tem 26 obras validadas com slugs únicos", () => {
    expect(CATALOG_WORKS).toHaveLength(26);
    const slugs = CATALOG_WORKS.map((w) => w.slug);
    expect(new Set(slugs).size).toBe(26);
  });

  it("mantém os episódios validados do MVP e das expansões", () => {
    const bySlug = new Map(CATALOG_WORKS.map((w) => [w.slug, w.episodes]));
    expect(bySlug.get("ubw")).toBe(26);
    expect(bySlug.get("zero")).toBe(25);
    expect(bySlug.get("babylonia")).toBe(21);
    expect(bySlug.get("camelot")).toBe(2);
    expect(bySlug.get("hf1")).toBe(1);
    expect(bySlug.get("fsn2006")).toBe(24);
    expect(bySlug.get("extra")).toBe(13);
    expect(bySlug.get("carnival")).toBe(12);
    expect(bySlug.get("prisma-3rei")).toBe(12);
  });

  it("tem 4 rotas com a Fuyuki como default e 5 obras", () => {
    expect(CATALOG_ROUTES).toHaveLength(4);
    const def = CATALOG_ROUTES.filter((r) => r.isDefault);
    expect(def).toHaveLength(1);
    expect(def[0]?.slug).toBe("fuyuki");
    expect(def[0]?.workSlugs).toEqual(["ubw", "hf1", "hf2", "hf3", "zero"]);
  });
});

describe("FateFlow Fase 1 — regras de progresso", () => {
  it("statusFor: concluido / progresso / proximo / faltam", () => {
    expect(statusFor(26, 26, 1)).toBe("concluido");
    expect(statusFor(1, 1, 2)).toBe("concluido");
    expect(statusFor(26, 14, 1)).toBe("progresso");
    expect(statusFor(26, 0, 1)).toBe("proximo");
    expect(statusFor(26, 0, 2)).toBe("proximo");
    expect(statusFor(25, 0, 5)).toBe("faltam");
  });

  it("clampWatched nunca excede o total nem fica negativo", () => {
    expect(clampWatched(26, 99)).toBe(26);
    expect(clampWatched(1, 5)).toBe(1);
    expect(clampWatched(26, -3)).toBe(0);
    expect(clampWatched(26, 14)).toBe(14);
  });

  it("overallProgress soma com clamp por obra", () => {
    const works = [
      { slug: "ubw", episodes: 26 },
      { slug: "hf1", episodes: 1 },
    ];
    const r = overallProgress(works, { ubw: 14, hf1: 5 });
    expect(r.total).toBe(27);
    expect(r.watched).toBe(15);
    expect(r.percent).toBe(Math.round((15 / 27) * 100));
  });
});

describe("motor de recomendação determinístico", () => {
  const works = [
    { slug: "ubw", shortTitle: "UBW", episodes: 26, order: 1 },
    { slug: "hf1", shortTitle: "HF1", episodes: 1, order: 2 },
    { slug: "zero", shortTitle: "Zero", episodes: 25, order: 5 },
  ];
  it("continua o que está a meio com motivo", () => {
    const [rec] = recommend(works, { ubw: 14 });
    expect(rec).toMatchObject({ workSlug: "ubw", kind: "continue", remaining: 12 });
    expect(rec.reason).toContain("UBW");
  });
  it("sugere o próximo da rota com pré-requisitos feitos", () => {
    const [rec] = recommend(works, { ubw: 26 });
    expect(rec).toMatchObject({ workSlug: "hf1", kind: "next" });
  });
  it("não salta para o fim quando há anteriores por ver", () => {
    const recs = recommend(works, {}, 3);
    expect(recs[0]).toMatchObject({ workSlug: "ubw" });
    expect(recs.map((r) => r.workSlug)).toContain("zero");
  });
  it("rota concluída devolve vazio", () => {
    expect(recommend(works, { ubw: 26, hf1: 1, zero: 25 })).toEqual([]);
  });
});

describe("FateFlow Fase 2 — autorização por utilizador", () => {
  it("progress.list rejeita anónimo com UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.progress.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("preferences.get rejeita anónimo com UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.preferences.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("activity.list rejeita anónimo com UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.activity.list({ limit: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("progress.markEpisode valida input (negativo rejeitado pelo zod)", async () => {
    const caller = appRouter.createCaller(userCtx());
    await expect(caller.progress.markEpisode({ workSlug: "ubw", watchedEpisodes: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("sem DATABASE_URL, utilizador autenticado recebe erro interno controlado (não crash)", async () => {
    // Em CI sem DB, getDb() devolve null → router mapeia para INTERNAL_SERVER_ERROR.
    const caller = appRouter.createCaller(userCtx());
    await expect(caller.progress.list()).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});
