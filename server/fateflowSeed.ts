/**
 * FateFlow — seed idempotente (Fase 1).
 * - Insere/atualiza as 15 obras canónicas, episódios genéricos, 4 rotas e route_items.
 * - Usa onDuplicateKeyUpdate → seguro correr várias vezes, nunca apaga dados.
 * - NÃO é chamado automaticamente no arranque (ver server/_core/index.ts — sem auto-seed).
 * - Uso: `pnpm db:seed` (requer DATABASE_URL).
 */
import { episodes, routeItems, routes, works } from "../drizzle/schema";
import { CATALOG_ROUTES, CATALOG_WORKS } from "../shared/fateflowCatalog";
import { getDb } from "./db";

function episodeTitle(workSlug: string, shortTitle: string, n: number, total: number): string {
  if (total === 1) return shortTitle;
  return `${shortTitle} — Episódio ${n}`;
}

export async function seedFateFlow() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL não configurada — seed abortado sem alterações.");

  // 1. Works (upsert por slug)
  for (const w of CATALOG_WORKS) {
    await db
      .insert(works)
      .values({
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
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
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
          isActive: true,
        },
      });
  }

  // Mapa slug -> id
  const allWorks = await db.select().from(works);
  const workIdBySlug = new Map(allWorks.map((w) => [w.slug, w.id]));

  // 2. Episodes genéricos (1..N por obra, idempotente)
  for (const w of CATALOG_WORKS) {
    const workId = workIdBySlug.get(w.slug);
    if (!workId) continue;
    for (let n = 1; n <= w.episodes; n++) {
      await db
        .insert(episodes)
        .values({ workId, episodeNumber: n, title: episodeTitle(w.slug, w.shortTitle, n, w.episodes) })
        .onDuplicateKeyUpdate({ set: { title: episodeTitle(w.slug, w.shortTitle, n, w.episodes) } });
    }
  }

  // 3. Routes (upsert por slug)
  for (const r of CATALOG_ROUTES) {
    await db
      .insert(routes)
      .values({ slug: r.slug, name: r.name, description: r.description, universe: r.universe ?? null, isDefault: r.isDefault })
      .onDuplicateKeyUpdate({
        set: { name: r.name, description: r.description, universe: r.universe ?? null, isDefault: r.isDefault },
      });
  }
  const allRoutes = await db.select().from(routes);
  const routeIdBySlug = new Map(allRoutes.map((r) => [r.slug, r.id]));

  // 4. Route items (upsert por par route+work via delete+insert ordenado?
  //    Para manter idempotência sem apagar progresso: upsert individual por (routeId, workId).)
  for (const r of CATALOG_ROUTES) {
    const routeId = routeIdBySlug.get(r.slug);
    if (!routeId) continue;
    let position = 1;
    for (const slug of r.workSlugs) {
      const workId = workIdBySlug.get(slug);
      if (!workId) continue;
      await db
        .insert(routeItems)
        .values({ routeId, workId, position, relationType: "required" })
        .onDuplicateKeyUpdate({ set: { position } });
      position += 1;
    }
  }

  return { works: CATALOG_WORKS.length, routes: CATALOG_ROUTES.length };
}
