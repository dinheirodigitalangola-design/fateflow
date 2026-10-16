/** Routers FateFlow — montados em server/routers.ts. */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { CATALOG_WORKS } from "../shared/fateflowCatalog";
import {
  addToLibrary,
  clearActivity,
  getUserPreferences,
  getUserProgressMap,
  getWorkBySlug,
  getWorkMeta,
  listActivity,
  listEpisodes,
  listEpisodesWithProgress,
  listFranchises,
  listLibrary,
  listRoutesWithItems,
  listWorks,
  markUpToEpisode,
  migrateLocalProgress,
  removeFromLibrary,
  resetAllProgress,
  setEpisodeWatched,
  setWorkActive,
  setWorkProgress,
  updateUserPreferences,
  updateWorkMeta,
  upsertWork,
  type AdminWorkInput,
} from "./fateflowDb";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

function dbError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "DATABASE_UNAVAILABLE") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível" });
  if (msg === "WORK_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Obra não encontrada" });
  if (msg === "FRANCHISE_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Franquia não encontrada" });
  if (msg === "EPISODE_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "Episódio não encontrado" });
  if (msg === "INVALID_RATING") throw new TRPCError({ code: "BAD_REQUEST", message: "Avaliação entre 1 e 5" });
  throw e;
}

const slugSchema = z.string().min(1).max(128);

export const franchisesRouter = router({
  list: publicProcedure.query(async () => {
    try {
      return await listFranchises();
    } catch (e) {
      return dbError(e);
    }
  }),
});

export const libraryRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listLibrary(ctx.user.id);
    } catch (e) {
      return dbError(e);
    }
  }),
  add: protectedProcedure.input(z.object({ workSlug: slugSchema })).mutation(async ({ ctx, input }) => {
    try {
      return await addToLibrary(ctx.user.id, input.workSlug);
    } catch (e) {
      return dbError(e);
    }
  }),
  remove: protectedProcedure.input(z.object({ workSlug: slugSchema })).mutation(async ({ ctx, input }) => {
    try {
      return await removeFromLibrary(ctx.user.id, input.workSlug);
    } catch (e) {
      return dbError(e);
    }
  }),
});

const episodeNumberSchema = z.number().int().min(1).max(1000);

export const episodesRouter = router({
  /** Episódios da obra com estado visto/não-visto do utilizador. */
  list: protectedProcedure.input(z.object({ workSlug: slugSchema })).query(async ({ ctx, input }) => {
    try {
      return await listEpisodesWithProgress(ctx.user.id, input.workSlug);
    } catch (e) {
      return dbError(e);
    }
  }),
  /** Marca/desmarca um episódio individual. */
  set: protectedProcedure
    .input(z.object({ workSlug: slugSchema, episodeNumber: episodeNumberSchema, watched: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await setEpisodeWatched(ctx.user.id, input.workSlug, input.episodeNumber, input.watched);
      } catch (e) {
        return dbError(e);
      }
    }),
  /** Saltar para o episódio N: marca 1..N (desmarca para a frente). N=0 limpa tudo. */
  markUpTo: protectedProcedure
    .input(z.object({ workSlug: slugSchema, episodeNumber: z.number().int().min(0).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await markUpToEpisode(ctx.user.id, input.workSlug, input.episodeNumber);
      } catch (e) {
        return dbError(e);
      }
    }),
});

export const catalogRouter = router({
  list: publicProcedure.input(z.object({ franchiseSlug: slugSchema.optional() }).optional()).query(async ({ input }) => {
    try {
      const rows = await listWorks(input?.franchiseSlug);
      return rows.map((r) => ({ ...r, franchiseSlug: (r as { franchiseSlug?: string | null }).franchiseSlug ?? null }));
    } catch {
      // fallback demo: catálogo estático quando a DB não está ligada
      const filtered = input?.franchiseSlug && input.franchiseSlug !== "fate" ? [] : CATALOG_WORKS;
      return filtered.map((w, i) => ({
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
        franchiseSlug: "fate" as string | null,
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
  resetAll: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await resetAllProgress(ctx.user.id);
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

const adminWorkInput = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(255),
  shortTitle: z.string().max(128).optional(),
  description: z.string().max(5000).optional(),
  year: z.string().max(32).optional(),
  format: z.enum(["Série", "Filme", "Especial", "OVA"]),
  universe: z.string().min(1).max(64),
  arc: z.string().max(128).optional(),
  orderIndex: z.number().int().min(0).max(10000),
  episodeCount: z.number().int().min(1).max(2000),
  color: z.string().max(32).optional(),
  badge: z.string().max(128).nullable().optional(),
  coverUrl: z.string().max(2000).nullable().optional(),
  franchiseSlug: slugSchema.optional(),
  isActive: z.boolean().optional(),
});

/** Administração do catálogo — só role admin. */
export const adminRouter = router({
  workUpsert: adminProcedure.input(adminWorkInput).mutation(async ({ input }) => {
    try {
      const data: AdminWorkInput = {
        slug: input.slug,
        title: input.title,
        shortTitle: input.shortTitle,
        description: input.description,
        year: input.year,
        format: input.format,
        universe: input.universe,
        arc: input.arc,
        orderIndex: input.orderIndex,
        episodeCount: input.episodeCount,
        color: input.color,
        badge: input.badge,
        coverUrl: input.coverUrl,
        franchiseSlug: input.franchiseSlug,
        isActive: input.isActive,
      };
      return await upsertWork(data);
    } catch (e) {
      return dbError(e);
    }
  }),
  workSetActive: adminProcedure.input(z.object({ slug: slugSchema, isActive: z.boolean() })).mutation(async ({ input }) => {
    try {
      return await setWorkActive(input.slug, input.isActive);
    } catch (e) {
      return dbError(e);
    }
  }),
});

/** Meta pessoal por obra: avaliação, notas, favorito. */
export const metaRouter = router({
  get: protectedProcedure.input(z.object({ workSlug: slugSchema })).query(async ({ ctx, input }) => {
    try {
      return await getWorkMeta(ctx.user.id, input.workSlug);
    } catch (e) {
      return dbError(e);
    }
  }),
  update: protectedProcedure
    .input(
      z.object({
        workSlug: slugSchema,
        rating: z.number().int().min(1).max(5).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        favorite: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateWorkMeta(ctx.user.id, input.workSlug, {
          rating: input.rating,
          notes: input.notes,
          favorite: input.favorite,
        });
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
