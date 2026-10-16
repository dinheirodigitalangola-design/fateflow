/** Routers FateFlow — montados em server/routers.ts. */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CATALOG_WORKS } from "../shared/fateflowCatalog";
import {
  clearActivity,
  getUserPreferences,
  getUserProgressMap,
  getWorkBySlug,
  listActivity,
  listEpisodes,
  listRoutesWithItems,
  listWorks,
  migrateLocalProgress,
  setWorkProgress,
  updateUserPreferences,
} from "./fateflowDb";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

function dbError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "DATABASE_UNAVAILABLE") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });
  if (msg === "WORK_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Obra não encontrada" });
  throw e;
}

const slugSchema = z.string().min(1).max(128);

export const catalogRouter = router({
  list: publicProcedure.query(async () => {
    try {
      return await listWorks();
    } catch {
      // fallback demo: catálogo estático quando a DB não está ligada
      return CATALOG_WORKS.map((w, i) => ({
        id: -(i + 1),
        slug: w.slug,
        title: w.title,
        shortTitle: w.shortTitle,
        description: w.description,
        year: w.year,
        format: w.format,
        universe: w.universe,
        arc: w.arc,
        orderIndex: w.order,
        episodeCount: w.episodes,
        color: w.color,
        badge: w.badge ?? null,
        coverUrl: null as string | null,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }));
    }
  }),
  getById: publicProcedure.input(z.object({ slug: slugSchema })).query(async ({ input }) => {
    try {
      const work = await getWorkBySlug(input.slug);
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "Obra não encontrada" });
      const eps = await listEpisodes(input.slug);
      return { ...work, episodesList: eps };
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      return dbError(e);
    }
  }),
});

export const routesRouter = router({
  list: publicProcedure.query(async () => {
    try {
      return await listRoutesWithItems();
    } catch (e) {
      return dbError(e);
    }
  }),
  getActive: protectedProcedure.query(async ({ ctx }) => {
    try {
      const prefs = await getUserPreferences(ctx.user.id);
      const all = await listRoutesWithItems();
      const active = all.find((r) => r.id === prefs.selectedRouteId) ?? all.find((r) => r.isDefault) ?? all[0] ?? null;
      return { prefs, active };
    } catch (e) {
      return dbError(e);
    }
  }),
  setActive: protectedProcedure.input(z.object({ routeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const all = await listRoutesWithItems();
      if (!all.some((r) => r.id === input.routeId)) throw new TRPCError({ code: "NOT_FOUND", message: "Rota não encontrada" });
      return await updateUserPreferences(ctx.user.id, { selectedRouteId: input.routeId });
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      return dbError(e);
    }
  }),
});

const progressInput = z.object({ workSlug: slugSchema, watchedEpisodes: z.number().int().min(0).max(1000) });

export const progressRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getUserProgressMap(ctx.user.id);
    } catch (e) {
      return dbError(e);
    }
  }),
  markEpisode: protectedProcedure.input(progressInput).mutation(async ({ ctx, input }) => {
    try {
      return await setWorkProgress(ctx.user.id, input.workSlug, input.watchedEpisodes);
    } catch (e) {
      return dbError(e);
    }
  }),
  markWork: protectedProcedure.input(z.object({ workSlug: slugSchema })).mutation(async ({ ctx, input }) => {
    try {
      const work = await getWorkBySlug(input.workSlug);
      if (!work) throw new TRPCError({ code: "NOT_FOUND", message: "Obra não encontrada" });
      return await setWorkProgress(ctx.user.id, input.workSlug, work.episodeCount);
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      return dbError(e);
    }
  }),
  resetWork: protectedProcedure.input(z.object({ workSlug: slugSchema })).mutation(async ({ ctx, input }) => {
    try {
      return await setWorkProgress(ctx.user.id, input.workSlug, 0);
    } catch (e) {
      return dbError(e);
    }
  }),
  migrate: protectedProcedure
    .input(z.object({ local: z.record(z.string(), z.number().int().min(0).max(1000)) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await migrateLocalProgress(ctx.user.id, input.local);
      } catch (e) {
        return dbError(e);
      }
    }),
});

export const activityRouter = router({
  list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).optional().default(50) })).query(async ({ ctx, input }) => {
    try {
      return await listActivity(ctx.user.id, input.limit);
    } catch (e) {
      return dbError(e);
    }
  }),
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await clearActivity(ctx.user.id);
    } catch (e) {
      return dbError(e);
    }
  }),
});

export const preferencesRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getUserPreferences(ctx.user.id);
    } catch (e) {
      return dbError(e);
    }
  }),
  update: protectedProcedure
    .input(
      z.object({
        selectedRouteId: z.number().int().positive().nullable().optional(),
        smartRecommendations: z.boolean().optional(),
        compactMode: z.boolean().optional(),
        language: z.string().min(2).max(16).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateUserPreferences(ctx.user.id, input);
      } catch (e) {
        return dbError(e);
      }
    }),
});
