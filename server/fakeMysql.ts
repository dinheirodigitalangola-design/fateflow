/**
 * Fake MySQL em memória para validação sem servidor live.
 * - Implementa o subconjunto da API drizzle usado em fateflowDb.ts / fateflowSeed.ts:
 *   select().from().where().orderBy().limit(), insert().values().onDuplicateKeyUpdate(),
 *   update().set().where(), delete().where().
 * - Os predicados `where` (eq/and) são compilados com o MySqlDialect REAL e avaliados
 *   contra as linhas — logo o isolamento por userId é testado de forma fiel.
 * - Upserts respeitam as mesmas chaves únicas das migrations 0001/0002.
 * NÃO é usada em produção — apenas em *.test.ts via vi.mock("./db").
 */
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const dialect = new MySqlDialect();

export type FakeStats = { inserts: number; updates: number; deletes: number; selects: number };

export function createFakeMysql() {
  const store: Record<string, Record<string, unknown>[]> = {
    users: [],
    franchises: [],
    works: [],
    episodes: [],
    routes: [],
    route_items: [],
    user_progress: [],
    user_episode_progress: [],
    user_work_meta: [],
    user_preferences: [],
    user_library: [],
    activity_log: [],
  };
  const seq: Record<string, number> = {};
  const stats: FakeStats = { inserts: 0, updates: 0, deletes: 0, selects: 0 };

  const keyOf = (table: object) => getTableName(table as never) as string;

  /** Avalia um predicado drizzle (eq/and) contra uma linha, via SQL compilado. */
  function matches(cond: unknown, row: Record<string, unknown>): boolean {
    try {
      const { sql, params } = dialect.sqlToQuery(cond as never);
      const cols: string[] = [];
      const re = /`(\w+)`\s*=\s*\?/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) cols.push(m[1] as string);
      if (cols.length !== (params as unknown[]).length) return true; // forma desconhecida → não filtrar
      return cols.every((c, i) => (row[c] as unknown) === (params as unknown[])[i]);
    } catch {
      return true;
    }
  }

  function nextId(key: string): number {
    seq[key] = (seq[key] ?? 0) + 1;
    return seq[key] as number;
  }

  /** Chave única lógica por tabela (espelha 0001/0002). */
  function sameUnique(key: string, a: Record<string, unknown>, b: Record<string, unknown>): boolean {
    switch (key) {
      case "users":
        return a.openId === b.openId;
      case "franchises":
        return a.slug === b.slug;
      case "works":
      case "routes":
        return a.slug === b.slug;
      case "episodes":
        return a.workId === b.workId && a.episodeNumber === b.episodeNumber;
      case "route_items":
      case "user_progress":
      case "user_library":
      case "user_episode_progress":
      case "user_work_meta":
        return (key === "route_items" ? a.routeId === b.routeId : a.userId === b.userId) && (key === "user_episode_progress" ? a.episodeId === b.episodeId : a.workId === b.workId);
      case "user_preferences":
        return a.userId === b.userId;
      default:
        return false;
    }
  }

  function queryable(table: object, cond: unknown, descOrder: boolean): unknown {
    const key = keyOf(table);
    const rows = () => {
      stats.selects += 1;
      // cópias (snapshot), como uma DB real — nunca referências vivas
      let r = (store[key] ?? []).map((row) => ({ ...row }));
      if (cond) r = r.filter((row) => matches(cond, row));
      if (descOrder) r = [...r].sort((x, y) => Number(y.id ?? 0) - Number(x.id ?? 0));
      return r;
    };
    return {
      where: (c: unknown) => queryable(table, c, false),
      orderBy: () => queryable(table, cond, true),
      limit: (n: number) => Promise.resolve(rows().slice(0, n)),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows()).then(res, rej),
    };
  }

  const db = {
    select: () => ({ from: (table: object) => queryable(table, null, false) }),
    insert: (table: object) => ({
      values: (v: Record<string, unknown> | Record<string, unknown>[]) => {
        const key = keyOf(table);
        const list = Array.isArray(v) ? v : [v];
        const apply = (set?: Record<string, unknown>) => {
          for (const values of list) {
            stats.inserts += 1;
            const existing = (store[key] ?? []).find((row) => sameUnique(key, row, values));
            if (existing && set) {
              Object.assign(existing, set);
            } else if (!existing) {
              const row: Record<string, unknown> = { ...values };
              if (key !== "user_preferences" && row.id == null) row.id = nextId(key);
              (store[key] ??= []).push(row);
            }
          }
          return Promise.resolve([]);
        };
        return { onDuplicateKeyUpdate: ({ set }: { set: Record<string, unknown> }) => apply(set), then: (res: (v: unknown) => unknown) => apply().then(res) };
      },
    }),
    update: (table: object) => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: unknown) => {
          const key = keyOf(table);
          let n = 0;
          for (const row of store[key] ?? []) {
            if (matches(cond, row)) {
              Object.assign(row, values);
              n += 1;
            }
          }
          stats.updates += n;
          return Promise.resolve([]);
        },
      }),
    }),
    delete: (table: object) => ({
      where: (cond: unknown) => {
        const key = keyOf(table);
        const before = (store[key] ?? []).length;
        store[key] = (store[key] ?? []).filter((row) => !matches(cond, row));
        stats.deletes += before - (store[key] ?? []).length;
        return Promise.resolve([]);
      },
    }),
  };

  return { db, store, stats };
}

export type FakeMysql = ReturnType<typeof createFakeMysql>;
