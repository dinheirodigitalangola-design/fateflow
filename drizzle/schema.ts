import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// FateFlow — Fase 1: modelo de dados de produção (aditivo, não remove users)
// Fase multi-anime: o catálogo organiza-se por franquia (Fate é apenas a 1ª).
// works/universe/arc mantêm-se (agrupamento interno da franquia); franchiseId
// diz a que anime pertence cada obra. Tudo aditivo e nullable para não
// quebrar dados existentes.
// ---------------------------------------------------------------------------

/** Franquias de anime (ex: fate, futuras: outros animes). */
export const franchises = mysqlTable("franchises", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Franchise = typeof franchises.$inferSelect;
export type InsertFranchise = typeof franchises.$inferInsert;

/** Catálogo de obras (normaliza as 15 obras do MVP em Home.tsx). */
export const works = mysqlTable("works", {
  id: int("id").autoincrement().primaryKey(),
  /** Slug estável usado pelo frontend, ex: "ubw", "hf1". */
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  shortTitle: varchar("shortTitle", { length: 128 }),
  description: text("description"),
  /** Ano como texto livre para suportar intervalos ("2014–2015"). */
  year: varchar("year", { length: 32 }),
  format: mysqlEnum("format", ["Série", "Filme", "Especial", "OVA"]).default("Série").notNull(),
  universe: varchar("universe", { length: 64 }).default("Fuyuki").notNull(),
  arc: varchar("arc", { length: 128 }),
  orderIndex: int("orderIndex").default(0).notNull(),
  episodeCount: int("episodeCount").default(1).notNull(),
  color: varchar("color", { length: 32 }),
  badge: varchar("badge", { length: 128 }),
  coverUrl: text("coverUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  /** Franquia a que a obra pertence (nullable = catálogo pré-franquias). */
  franchiseId: int("franchiseId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Work = typeof works.$inferSelect;
export type InsertWork = typeof works.$inferInsert;

/** Episódios/filmes individuais por obra (para detalhe futuro e marcação granular). */
export const episodes = mysqlTable("episodes", {
  id: int("id").autoincrement().primaryKey(),
  workId: int("workId").notNull(),
  episodeNumber: int("episodeNumber").notNull(),
  title: varchar("title", { length: 255 }),
  durationMinutes: int("durationMinutes"),
  synopsis: text("synopsis"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("episodes_work_episode_unique").on(table.workId, table.episodeNumber),
]);

export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;

/** Rotas de visualização (Fuyuki, Grand Order, etc.). */
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  universe: varchar("universe", { length: 64 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  /** Franquia da rota (nullable = rotas pré-franquias). */
  franchiseId: int("franchiseId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;

/** Itens de cada rota (ordem + opcionalidade). */
export const routeItems = mysqlTable("route_items", {
  id: int("id").autoincrement().primaryKey(),
  routeId: int("routeId").notNull(),
  workId: int("workId").notNull(),
  position: int("position").default(0).notNull(),
  relationType: mysqlEnum("relationType", ["required", "optional"]).default("required").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("route_items_route_work_unique").on(table.routeId, table.workId),
]);

export type RouteItem = typeof routeItems.$inferSelect;
export type InsertRouteItem = typeof routeItems.$inferInsert;

/** Progresso por utilizador + obra (fonte de verdade pós-login). */
export const userProgress = mysqlTable("user_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workId: int("workId").notNull(),
  watchedEpisodes: int("watchedEpisodes").default(0).notNull(),
  status: mysqlEnum("status", ["concluido", "progresso", "proximo", "faltam"]).default("faltam").notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("user_progress_user_work_unique").on(table.userId, table.workId),
]);

export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = typeof userProgress.$inferInsert;

/** Preferências persistidas por utilizador. */
export const userPreferences = mysqlTable("user_preferences", {
  userId: int("userId").primaryKey(),
  selectedRouteId: int("selectedRouteId"),
  smartRecommendations: boolean("smartRecommendations").default(true).notNull(),
  compactMode: boolean("compactMode").default(false).notNull(),
  language: varchar("language", { length: 16 }).default("pt-BR").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserPreferences = typeof userPreferences.$inferSelect;
export type InsertUserPreferences = typeof userPreferences.$inferInsert;

/** Histórico persistente de atividade. */
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  actionType: varchar("actionType", { length: 64 }).notNull(),
  workId: int("workId"),
  episodeId: int("episodeId"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

/** Biblioteca pessoal: obras que o utilizador escolheu acompanhar (multi-anime).
 * O progresso continua em user_progress; esta tabela diz *o quê* seguir. */
export const userLibrary = mysqlTable("user_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  workId: int("workId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_library_user_work_unique").on(table.userId, table.workId),
]);

export type UserLibrary = typeof userLibrary.$inferSelect;
export type InsertUserLibrary = typeof userLibrary.$inferInsert;

/** Episódios vistos por utilizador (granularidade individual).
 * user_progress.watchedEpisodes continua como agregado (= nº de linhas aqui). */
export const userEpisodeProgress = mysqlTable("user_episode_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  episodeId: int("episodeId").notNull(),
  watchedAt: timestamp("watchedAt").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_episode_user_episode_unique").on(table.userId, table.episodeId),
]);

export type UserEpisodeProgress = typeof userEpisodeProgress.$inferSelect;
export type InsertUserEpisodeProgress = typeof userEpisodeProgress.$inferInsert;

/** Meta pessoal por obra: avaliação, notas e favorito. */
export const userWorkMeta = mysqlTable("user_work_meta", {
  userId: int("userId").notNull(),
  workId: int("workId").notNull(),
  rating: int("rating"),
  notes: text("notes"),
  favorite: boolean("favorite").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex("user_work_meta_user_work_unique").on(table.userId, table.workId),
]);

export type UserWorkMeta = typeof userWorkMeta.$inferSelect;
export type InsertUserWorkMeta = typeof userWorkMeta.$inferInsert;