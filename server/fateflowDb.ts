/** Queries FateFlow sobre o Drizzle. userId vem sempre do ctx autenticado — nunca do browser. */
import { and, desc, eq } from "drizzle-orm";
import { activityLog, episodes, routeItems, routes, userPreferences, userProgress, works } from "../drizzle/schema";
import { clampWatched, statusFor } from "../shared/fateflowCatalog";
import { getDb } from "./db";

async function dbOrThrow() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function listWorks() {
  const db = await dbOrThrow();
  const rows = await db.select().from(works);
  return [...rows].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
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
