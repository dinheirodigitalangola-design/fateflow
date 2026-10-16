/** Queries FateFlow sobre o Drizzle. userId vem sempre do ctx autenticado — nunca do browser. */
import { and, desc, eq } from "drizzle-orm";
import { activityLog, episodes, franchises, routeItems, routes, userEpisodeProgress, userLibrary, userPreferences, userProgress, userWorkMeta, works } from "../drizzle/schema";
import { clampWatched, statusFor } from "../shared/fateflowCatalog";
import { getDb } from "./db";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function listFranchises() {
  const db = await dbOrThrow();
  const rows = await db.select().from(franchises);
  return [...rows].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function listWorks(franchiseSlug?: string) {
  const db = await dbOrThrow();
  const allFranchises = await db.select().from(franchises);
  const slugById = new Map(allFranchises.map((f) => [f.id, f.slug]));
  let rows = await db.select().from(works);
  if (franchiseSlug) {
    const fid = allFranchises.find((f) => f.slug === franchiseSlug)?.id;
    if (fid == null) return [];
    rows = rows.filter((w) => w.franchiseId === fid);
  }
  return [...rows]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((w) => ({ ...w, franchiseSlug: (w.franchiseId != null ? slugById.get(w.franchiseId) : undefined) ?? null }));
}

/** Biblioteca pessoal: obras que o utilizador escolheu acompanhar. */
export async function listLibrary(userId: number) {
  const db = await dbOrThrow();
  const entries = await db.select().from(userLibrary).where(eq(userLibrary.userId, userId));
  const allWorks = await db.select().from(works);
  const byId = new Map(allWorks.map((w) => [w.id, w]));
  return [...entries]
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((e) => ({ ...e, work: byId.get(e.workId) ?? null }));
}

export async function addToLibrary(userId: number, workSlug: string) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  await db.insert(userLibrary).values({ userId, workId: work.id }).onDuplicateKeyUpdate({ set: { userId } });
  return { slug: work.slug, added: true as const };
}

export async function removeFromLibrary(userId: number, workSlug: string) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  await db.delete(userLibrary).where(and(eq(userLibrary.userId, userId), eq(userLibrary.workId, work.id)));
  return { slug: work.slug, removed: true as const };
}

export async function getWorkBySlug(slug: string) {
  const db = await dbOrThrow();
  const rows = await db.select().from(works).where(eq(works.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listRoutesWithItems() {
  const db = await dbOrThrow();
  const allRoutes = await db.select().from(routes);
  const items = await db.select().from(routeItems);
  const worksById = new Map((await db.select().from(works)).map((w) => [w.id, w]));
  return allRoutes.map((r) => ({
    ...r,
    items: items
      .filter((i) => i.routeId === r.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ ...i, work: worksById.get(i.workId) ?? null })),
  }));
}

export async function getUserPreferences(userId: number) {
  const db = await dbOrThrow();
  const rows = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  // default sem gravar (grava no primeiro update)
  return { userId, selectedRouteId: null as number | null, smartRecommendations: true, compactMode: false, language: "pt-BR", updatedAt: new Date() };
}

export async function updateUserPreferences(
  userId: number,
  input: { selectedRouteId?: number | null; smartRecommendations?: boolean; compactMode?: boolean; language?: string },
) {
  const db = await dbOrThrow();
  const current = await getUserPreferences(userId);
  const next = {
    userId,
    selectedRouteId: input.selectedRouteId !== undefined ? input.selectedRouteId : (current.selectedRouteId ?? null),
    smartRecommendations: input.smartRecommendations ?? current.smartRecommendations ?? true,
    compactMode: input.compactMode ?? current.compactMode ?? false,
    language: (input.language ?? current.language ?? "pt-BR").slice(0, 16),
  };
  await db.insert(userPreferences).values(next).onDuplicateKeyUpdate({
    set: { selectedRouteId: next.selectedRouteId, smartRecommendations: next.smartRecommendations, compactMode: next.compactMode, language: next.language },
  });
  return next;
}

export async function getUserProgressMap(userId: number): Promise<Record<string, number>> {
  const db = await dbOrThrow();
  const allWorks = await db.select().from(works);
  const idToSlug = new Map(allWorks.map((w) => [w.id, w.slug]));
  const rows = await db.select().from(userProgress).where(eq(userProgress.userId, userId));
  const map: Record<string, number> = {};
  for (const r of rows) {
    const slug = idToSlug.get(r.workId);
    if (slug) map[slug] = r.watchedEpisodes;
  }
  return map;
}

export async function setWorkProgress(userId: number, workSlug: string, watchedRaw: number) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  const watched = clampWatched(work.episodeCount, watchedRaw);
  const status = statusFor(work.episodeCount, watched, work.orderIndex ?? 99);
  const existing = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.workId, work.id)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(userProgress)
      .set({ watchedEpisodes: watched, status, completedAt: watched >= work.episodeCount ? new Date() : null })
      .where(and(eq(userProgress.userId, userId), eq(userProgress.workId, work.id)));
  } else {
    await db.insert(userProgress).values({
      userId,
      workId: work.id,
      watchedEpisodes: watched,
      status,
      completedAt: watched >= work.episodeCount ? new Date() : null,
    });
  }

  // Reconcilia as linhas individuais: contagem N == primeiros N episódios vistos.
  await syncEpisodeRows(db, userId, work.id, watched);

  // histórico server-side (só quando avança)
  const prev = existing[0]?.watchedEpisodes ?? 0;
  if (watched > prev) {
    await db.insert(activityLog).values({
      userId,
      actionType: watched >= work.episodeCount ? "work_completed" : "episode_completed",
      workId: work.id,
      metadata: { slug: work.slug, from: prev, to: watched },
    });
  } else if (watched === 0 && prev > 0) {
    await db.insert(activityLog).values({ userId, actionType: "work_reset", workId: work.id, metadata: { slug: work.slug } });
  }

  return { slug: work.slug, watchedEpisodes: watched, status };
}

/** Repor total: apaga todo o progresso e histórico do utilizador (sempre filtrado por userId). */
export async function resetAllProgress(userId: number) {
  const db = await dbOrThrow();
  const rows = await db.select().from(userProgress).where(eq(userProgress.userId, userId));
  await db.delete(userProgress).where(eq(userProgress.userId, userId));
  await db.delete(activityLog).where(eq(activityLog.userId, userId));
  return { resetWorks: rows.length };
}

/** Migração localStorage -> conta: para cada slug, fica o max(db, local), com clamp. */
export async function migrateLocalProgress(userId: number, local: Record<string, number>) {
  const db = await dbOrThrow();
  const allWorks = await db.select().from(works);
  const bySlug = new Map(allWorks.map((w) => [w.slug, w]));
  const current = await getUserProgressMap(userId);
  const merged: Record<string, number> = {};
  let migrated = 0;
  for (const [slug, rawLocal] of Object.entries(local)) {
    const work = bySlug.get(slug);
    if (!work) continue;
    const next = Math.max(clampWatched(work.episodeCount, rawLocal), current[slug] ?? 0);
    if (next !== (current[slug] ?? 0)) {
      await setWorkProgress(userId, slug, next);
      migrated += 1;
    }
    merged[slug] = next;
  }
  if (migrated > 0) {
    await db.insert(activityLog).values({ userId, actionType: "progress_migrated", metadata: { count: migrated } });
  }
  return { migrated, progress: await getUserProgressMap(userId) };
}

export async function listActivity(userId: number, limit = 50) {
  const db = await dbOrThrow();
  const rows = await db.select().from(activityLog).where(eq(activityLog.userId, userId)).orderBy(desc(activityLog.id)).limit(Math.min(200, Math.max(1, limit)));
  const worksById = new Map((await db.select().from(works)).map((w) => [w.id, w]));
  return rows.map((r) => ({ ...r, work: r.workId ? (worksById.get(r.workId) ?? null) : null }));
}

export async function clearActivity(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  // delete sempre filtrado por userId — nunca global
  await db.delete(activityLog).where(eq(activityLog.userId, userId));
  return { success: true as const };
}

export async function listEpisodes(workSlug: string) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) return [];
  const rows = await db.select().from(episodes).where(eq(episodes.workId, work.id));
  return [...rows].sort((a, b) => a.episodeNumber - b.episodeNumber);
}

export type AdminWorkInput = {
  slug: string;
  title: string;
  shortTitle?: string;
  description?: string;
  year?: string;
  format: "Série" | "Filme" | "Especial" | "OVA";
  universe: string;
  arc?: string;
  orderIndex: number;
  episodeCount: number;
  color?: string;
  badge?: string | null;
  coverUrl?: string | null;
  franchiseSlug?: string;
  isActive?: boolean;
};

/** Upsert administrativo de obra (cria ou atualiza por slug). */
export async function upsertWork(input: AdminWorkInput) {
  const db = await dbOrThrow();
  let franchiseId: number | null = null;
  if (input.franchiseSlug) {
    const frows = await db.select().from(franchises).where(eq(franchises.slug, input.franchiseSlug)).limit(1);
    if (!frows[0]) throw new Error("FRANCHISE_NOT_FOUND");
    franchiseId = frows[0].id;
  }
  const values = {
    slug: input.slug,
    title: input.title,
    shortTitle: input.shortTitle ?? null,
    description: input.description ?? null,
    year: input.year ?? null,
    format: input.format,
    universe: input.universe,
    arc: input.arc ?? null,
    orderIndex: input.orderIndex,
    episodeCount: input.episodeCount,
    color: input.color ?? null,
    badge: input.badge ?? null,
    coverUrl: input.coverUrl ?? null,
    franchiseId,
    isActive: input.isActive ?? true,
  };
  await db.insert(works).values(values).onDuplicateKeyUpdate({ set: { ...values } });
  return (await getWorkBySlug(input.slug))!;
}

export async function setWorkActive(slug: string, isActive: boolean) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(slug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  await db.update(works).set({ isActive }).where(eq(works.slug, slug));
  return { slug, isActive };
}

export type WorkMetaInput = { rating?: number | null; notes?: string | null; favorite?: boolean };

/** Meta pessoal da obra (avaliação 1–5, notas, favorito). */
export async function getWorkMeta(userId: number, workSlug: string) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  const rows = await db
    .select()
    .from(userWorkMeta)
    .where(and(eq(userWorkMeta.userId, userId), eq(userWorkMeta.workId, work.id)))
    .limit(1);
  return rows[0] ?? { userId, workId: work.id, rating: null as number | null, notes: null as string | null, favorite: false, updatedAt: null as Date | null };
}

export async function updateWorkMeta(userId: number, workSlug: string, input: WorkMetaInput) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  if (input.rating !== undefined && input.rating !== null && (input.rating < 1 || input.rating > 5)) {
    throw new Error("INVALID_RATING");
  }
  const values = {
    userId,
    workId: work.id,
    rating: input.rating !== undefined ? input.rating : undefined,
    notes: input.notes !== undefined ? (input.notes ? input.notes.slice(0, 2000) : null) : undefined,
    favorite: input.favorite,
  };
  const current = await getWorkMeta(userId, workSlug);
  const next = {
    userId,
    workId: work.id,
    rating: values.rating !== undefined ? values.rating : current.rating,
    notes: values.notes !== undefined ? values.notes : current.notes,
    favorite: values.favorite ?? current.favorite,
  };
  await db.insert(userWorkMeta).values(next).onDuplicateKeyUpdate({ set: { rating: next.rating, notes: next.notes, favorite: next.favorite } });
  return next;
}

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

async function orderedEpisodeIds(db: Db, workId: number): Promise<number[]> {
  const rows = await db.select().from(episodes).where(eq(episodes.workId, workId));
  return [...rows].sort((a, b) => a.episodeNumber - b.episodeNumber).map((e) => e.id);
}

async function watchedEpisodeIds(db: Db, userId: number): Promise<Set<number>> {
  const rows = await db.select().from(userEpisodeProgress).where(eq(userEpisodeProgress.userId, userId));
  return new Set(rows.map((r) => r.episodeId as number));
}

/** Garante que exatamente os primeiros `count` episódios ficam marcados. */
async function syncEpisodeRows(db: Db, userId: number, workId: number, count: number): Promise<void> {
  const ordered = await orderedEpisodeIds(db, workId);
  const keep = new Set(ordered.slice(0, Math.max(0, count)));
  const watched = await watchedEpisodeIds(db, userId);
  for (const episodeId of keep) {
    if (!watched.has(episodeId)) {
      await db.insert(userEpisodeProgress).values({ userId, episodeId }).onDuplicateKeyUpdate({ set: { userId } });
    }
  }
  for (const episodeId of ordered) {
    if (!keep.has(episodeId) && watched.has(episodeId)) {
      await db.delete(userEpisodeProgress).where(and(eq(userEpisodeProgress.userId, userId), eq(userEpisodeProgress.episodeId, episodeId)));
    }
  }
}

async function recountWork(db: Db, userId: number, work: { id: number; episodeCount: number; orderIndex: number | null; slug: string }) {
  const ordered = await orderedEpisodeIds(db, work.id);
  const watched = await watchedEpisodeIds(db, userId);
  const count = ordered.filter((id) => watched.has(id)).length;
  const status = statusFor(work.episodeCount, count, work.orderIndex ?? 99);
  const existing = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.userId, userId), eq(userProgress.workId, work.id)))
    .limit(1);
  const row = {
    userId,
    workId: work.id,
    watchedEpisodes: count,
    status,
    completedAt: count >= work.episodeCount ? new Date() : null,
  };
  if (existing[0]) {
    await db.update(userProgress).set(row).where(and(eq(userProgress.userId, userId), eq(userProgress.workId, work.id)));
  } else {
    await db.insert(userProgress).values(row);
  }
  return { count, status };
}

function prevCountOf(map: Record<string, number>, slug: string): number {
  return map[slug] ?? 0;
}

export async function listEpisodesWithProgress(userId: number, workSlug: string) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  const rows = await db.select().from(episodes).where(eq(episodes.workId, work.id));
  const watched = await watchedEpisodeIds(db, userId);
  const list = [...rows]
    .sort((a, b) => a.episodeNumber - b.episodeNumber)
    .map((e) => ({ ...e, watched: watched.has(e.id) }));
  const watchedCount = list.filter((e) => e.watched).length;
  const nextEpisode = list.find((e) => !e.watched)?.episodeNumber ?? null;
  return { work, episodes: list, watchedCount, nextEpisode };
}

export async function setEpisodeWatched(userId: number, workSlug: string, episodeNumber: number, watched: boolean) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  const epRows = await db.select().from(episodes).where(eq(episodes.workId, work.id));
  const ep = epRows.find((e) => e.episodeNumber === episodeNumber);
  if (!ep) throw new Error("EPISODE_NOT_FOUND");
  const before = await getUserProgressMap(userId);
  const prev = prevCountOf(before, work.slug);
  if (watched) {
    await db.insert(userEpisodeProgress).values({ userId, episodeId: ep.id }).onDuplicateKeyUpdate({ set: { userId } });
  } else {
    await db.delete(userEpisodeProgress).where(and(eq(userEpisodeProgress.userId, userId), eq(userEpisodeProgress.episodeId, ep.id)));
  }
  const { count, status } = await recountWork(db, userId, work);
  if (count > prev) {
    await db.insert(activityLog).values({
      userId,
      actionType: count >= work.episodeCount ? "work_completed" : "episode_completed",
      workId: work.id,
      episodeId: ep.id,
      metadata: { slug: work.slug, episode: episodeNumber, from: prev, to: count },
    });
  } else if (count === 0 && prev > 0) {
    await db.insert(activityLog).values({ userId, actionType: "work_reset", workId: work.id, metadata: { slug: work.slug } });
  }
  return { slug: work.slug, episodeNumber, watched, watchedEpisodes: count, status };
}

/** Saltar para o episódio N: marca 1..N como vistos (e desmarca para a frente). */
export async function markUpToEpisode(userId: number, workSlug: string, episodeNumber: number) {
  const db = await dbOrThrow();
  const work = await getWorkBySlug(workSlug);
  if (!work) throw new Error("WORK_NOT_FOUND");
  const target = clampWatched(work.episodeCount, episodeNumber);
  const before = await getUserProgressMap(userId);
  const prev = prevCountOf(before, work.slug);
  await syncEpisodeRows(db, userId, work.id, target);
  const { count, status } = await recountWork(db, userId, work);
  if (count > prev) {
    await db.insert(activityLog).values({
      userId,
      actionType: count >= work.episodeCount ? "work_completed" : "episode_completed",
      workId: work.id,
      metadata: { slug: work.slug, jumpTo: target, from: prev, to: count },
    });
  }
  return { slug: work.slug, watchedEpisodes: count, status };
}
