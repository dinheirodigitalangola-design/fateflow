/**
 * FateFlow — catálogo canónico das 15 obras do MVP.
 * Fonte única para seed backend, fallback frontend e testes.
 * NÃO aumentar sem validar fontes e nº de episódios (handoff §6.4).
 */

export type WorkFormat = "Série" | "Filme" | "Especial" | "OVA";
export type Universe = "Fuyuki" | "Grand Order" | "Alternativo" | "Prisma☆Illya" | "Comédia";
export type ProgressStatus = "concluido" | "progresso" | "proximo" | "faltam";

export interface CatalogWork {
  slug: string;
  title: string;
  shortTitle: string;
  year: string;
  format: WorkFormat;
  episodes: number;
  universe: Universe;
  arc: string;
  order: number;
  color: string;
  description: string;
  badge?: string;
}

export interface CatalogRoute {
  slug: string;
  name: string;
  description: string;
  universe?: string;
  isDefault: boolean;
  /** slugs de works por ordem */
  workSlugs: string[];
}

export const CATALOG_WORKS: CatalogWork[] = [
  { slug: "fsn2006", title: "Fate/stay night (2006)", shortTitle: "Fate/stay night 2006", year: "2006", format: "Série", episodes: 24, universe: "Fuyuki", arc: "Versão 2006", order: 0, color: "crimson", description: "A adaptação original da visual novel pelo Studio Deen — rota alternativa para completar depois da principal.", badge: "Versão 2006" },
  { slug: "ubw", title: "Fate/stay night: Unlimited Blade Works", shortTitle: "Unlimited Blade Works", year: "2014–2015", format: "Série", episodes: 26, universe: "Fuyuki", arc: "Rota principal", order: 1, color: "crimson", description: "A melhor porta de entrada moderna para o conflito de Fuyuki. Acompanha Shirou Emiya e Rin Tohsaka na Guerra do Santo Graal.", badge: "Comece aqui" },
  { slug: "hf1", title: "Fate/stay night: Heaven’s Feel I — Presage Flower", shortTitle: "Heaven’s Feel I", year: "2017", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 2, color: "crimson", description: "O primeiro filme da trilogia que aprofunda a rota de Sakura Matou." },
  { slug: "hf2", title: "Fate/stay night: Heaven’s Feel II — Lost Butterfly", shortTitle: "Heaven’s Feel II", year: "2019", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 3, color: "crimson", description: "A segunda parte da trilogia cinematográfica de Heaven’s Feel." },
  { slug: "hf3", title: "Fate/stay night: Heaven’s Feel III — Spring Song", shortTitle: "Heaven’s Feel III", year: "2020", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 4, color: "crimson", description: "O encerramento da rota principal de Fuyuki em três atos cinematográficos." },
  { slug: "zero", title: "Fate/Zero", shortTitle: "Fate/Zero", year: "2011–2012", format: "Série", episodes: 25, universe: "Fuyuki", arc: "Rota principal", order: 5, color: "crimson", description: "O prequel da Quarta Guerra do Santo Graal, melhor aproveitado depois de Heaven’s Feel." },
  { slug: "first-order", title: "Fate/Grand Order: First Order", shortTitle: "Grand Order: First Order", year: "2016", format: "Especial", episodes: 1, universe: "Grand Order", arc: "Grand Order", order: 6, color: "teal", description: "A introdução animada à missão da Chaldea para preservar a humanidade." },
  { slug: "camelot", title: "Fate/Grand Order: Divine Realm of the Round Table — Camelot", shortTitle: "Grand Order: Camelot", year: "2020–2021", format: "Filme", episodes: 2, universe: "Grand Order", arc: "Grand Order", order: 7, color: "teal", description: "Dois filmes que adaptam a sexta singularidade, com Bedivere e o Rei Leão." },
  { slug: "babylonia", title: "Fate/Grand Order: Absolute Demonic Front — Babylonia", shortTitle: "Grand Order: Babylonia", year: "2019–2020", format: "Série", episodes: 21, universe: "Grand Order", arc: "Grand Order", order: 8, color: "teal", description: "A sétima singularidade na antiga Mesopotâmia, com Gilgamesh e a humanidade em risco." },
  { slug: "solomon", title: "Fate/Grand Order: Final Singularity — Grand Temple of Time: Solomon", shortTitle: "Grand Order: Solomon", year: "2021", format: "Filme", episodes: 1, universe: "Grand Order", arc: "Grand Order", order: 9, color: "teal", description: "O clímax do primeiro grande arco de Grand Order." },
  { slug: "apocrypha", title: "Fate/Apocrypha", shortTitle: "Fate/Apocrypha", year: "2017", format: "Série", episodes: 25, universe: "Alternativo", arc: "Universos alternativos", order: 10, color: "blue", description: "Uma guerra de duas facções, com catorze Servants em confronto." },
  { slug: "strange-fake", title: "Fate/strange Fake —Whispers of Dawn—", shortTitle: "Fate/strange Fake", year: "2023", format: "Especial", episodes: 1, universe: "Alternativo", arc: "Universos alternativos", order: 11, color: "blue", description: "Uma Guerra do Santo Graal falsa nos Estados Unidos, com regras próprias." },
  { slug: "lord-el-melloi", title: "The Case Files of Lord El-Melloi II", shortTitle: "Lord El-Melloi II", year: "2019", format: "Série", episodes: 13, universe: "Alternativo", arc: "Universos alternativos", order: 12, color: "blue", description: "Waver Velvet resolve mistérios mágicos anos depois dos acontecimentos de Fate/Zero." },
  { slug: "prisma", title: "Fate/kaleid liner Prisma☆Illya", shortTitle: "Prisma☆Illya", year: "2013", format: "Série", episodes: 10, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 13, color: "violet", description: "Uma releitura magical girl da franquia com Illya no centro da história." },
  { slug: "prisma-2wei", title: "Fate/kaleid liner Prisma☆Illya 2wei!", shortTitle: "Prisma☆Illya 2wei!", year: "2014", format: "Série", episodes: 10, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 14, color: "violet", description: "A segunda temporada do spin-off de magical girl." },
  { slug: "emiya-menu", title: "Today’s Menu for the Emiya Family", shortTitle: "Today’s Menu", year: "2017–2019", format: "Série", episodes: 13, universe: "Comédia", arc: "Comédia", order: 15, color: "amber", description: "Um spin-off calmo e delicioso sobre a vida quotidiana dos personagens." },
  { slug: "extra", title: "Fate/EXTRA Last Encore", shortTitle: "EXTRA Last Encore", year: "2018", format: "Série", episodes: 13, universe: "Alternativo", arc: "Universos alternativos", order: 16, color: "blue", description: "Hakuno Kishinami acorda na Moon Cell sem memórias — uma Guerra alternativa e sombria." },
  { slug: "prototype", title: "Fate/Prototype", shortTitle: "Fate/Prototype", year: "2011", format: "Especial", episodes: 1, universe: "Alternativo", arc: "Universos alternativos", order: 17, color: "blue", description: "O OVA com a Guerra original concebida por Kinoko Nasu, com Ayaka Sajyou e um Saber masculino." },
  { slug: "carnival", title: "Carnival Phantasm", shortTitle: "Carnival Phantasm", year: "2011–2012", format: "OVA", episodes: 12, universe: "Comédia", arc: "Comédia", order: 18, color: "amber", description: "Paródia oficial com os elencos de Fate/stay night e Tsukihime em esquetes absurdas." },
  { slug: "prisma-herz", title: "Fate/kaleid liner Prisma☆Illya 2wei Herz!", shortTitle: "Prisma☆Illya Herz!", year: "2015", format: "Série", episodes: 10, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 19, color: "violet", description: "A terceira temporada do spin-off magical girl." },
  { slug: "prisma-3rei", title: "Fate/kaleid liner Prisma☆Illya 3rei!!", shortTitle: "Prisma☆Illya 3rei!!", year: "2016", format: "Série", episodes: 12, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 20, color: "violet", description: "A quarta temporada, com a viagem ao mundo de Miyu." },
  { slug: "prisma-snow", title: "Fate/kaleid liner Prisma☆Illya: Vow in the Snow", shortTitle: "Prisma: Vow in the Snow", year: "2017", format: "Filme", episodes: 1, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 21, color: "violet", description: "O passado de Miyu e o juramento de Shirou — o filme mais dramático do spin-off." },
  { slug: "prisma-licht", title: "Fate/kaleid liner Prisma☆Illya: Licht", shortTitle: "Prisma: Licht", year: "2021", format: "Filme", episodes: 1, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 22, color: "violet", description: "A continuação cinematográfica contra a família Ainsworth." },
  { slug: "prisma-phantasm", title: "Prisma Phantasm", shortTitle: "Prisma Phantasm", year: "2019", format: "OVA", episodes: 1, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 23, color: "violet", description: "Episódio especial de comédia com o elenco de Prisma☆Illya." },
  { slug: "melloi-special", title: "Lord El-Melloi II Special", shortTitle: "El-Melloi II Especial", year: "2021", format: "Especial", episodes: 1, universe: "Alternativo", arc: "Universos alternativos", order: 24, color: "blue", description: "Waver, reencontro e a lanterna mágica — especial de fim de ano." },
  { slug: "moonlight", title: "Fate/Grand Order: Moonlight/Lostroom", shortTitle: "Grand Order: Moonlight", year: "2017", format: "Especial", episodes: 1, universe: "Grand Order", arc: "Grand Order", order: 25, color: "teal", description: "O prólogo enigmático da jornada da Chaldea, com Mash e o mestre desconhecido." },
];

export const CATALOG_ROUTES: CatalogRoute[] = [
  {
    slug: "fuyuki",
    name: "Rota principal — Fuyuki",
    description: "Ordem recomendada do arco de Fuyuki: UBW → Heaven's Feel → Zero.",
    universe: "Fuyuki",
    isDefault: true,
    workSlugs: ["ubw", "hf1", "hf2", "hf3", "zero"],
  },
  {
    slug: "grand-order",
    name: "Grand Order — Singularidades",
    description: "Do prólogo Moonlight ao Templo de Salomão.",
    universe: "Grand Order",
    isDefault: false,
    workSlugs: ["moonlight", "first-order", "camelot", "babylonia", "solomon"],
  },
  {
    slug: "prisma-illya",
    name: "Prisma☆Illya — Ordem completa",
    description: "Spin-off magical girl por ordem de lançamento.",
    universe: "Prisma☆Illya",
    isDefault: false,
    workSlugs: ["prisma", "prisma-2wei", "prisma-herz", "prisma-3rei", "prisma-snow", "prisma-licht", "prisma-phantasm"],
  },
  {
    slug: "exploracao-livre",
    name: "Exploração livre",
    description: "Todas as 15 obras por ordem canónica, sem pré-requisitos rígidos.",
    isDefault: false,
    workSlugs: CATALOG_WORKS.map((w) => w.slug),
  },
];

/** Regras puras de progresso — partilhadas entre frontend, backend e testes. */
export function statusFor(episodeCount: number, watched: number, order = 99): ProgressStatus {
  if (watched >= episodeCount) return "concluido";
  if (watched > 0) return "progresso";
  if (order === 1 || order === 2) return "proximo";
  return "faltam";
}

export function clampWatched(episodeCount: number, watched: number): number {
  if (!Number.isFinite(watched)) return 0;
  return Math.max(0, Math.min(episodeCount, Math.floor(watched)));
}

export function overallProgress(works: { slug: string; episodes: number }[], progress: Record<string, number>): { total: number; watched: number; percent: number } {
  const total = works.reduce((s, w) => s + w.episodes, 0);
  const watched = works.reduce((s, w) => s + clampWatched(w.episodes, progress[w.slug] ?? 0), 0);
  const percent = total === 0 ? 0 : Math.round((watched / total) * 100);
  return { total, watched, percent };
}

export interface Recommendation {
  workSlug: string;
  shortTitle: string;
  kind: "continue" | "next" | "start";
  remaining: number;
  reason: string;
}

/**
 * Motor determinístico de recomendação (sem IA): respeita a ordem da rota,
 * continua o que está a meio, nunca salta pré-requisitos e explica o motivo.
 */
export function recommend(
  works: { slug: string; shortTitle: string; episodes: number; order: number }[],
  progress: Record<string, number>,
  limit = 1,
): Recommendation[] {
  const ordered = [...works].sort((a, b) => a.order - b.order);
  const watchedOf = (slug: string, total: number) => clampWatched(total, progress[slug] ?? 0);
  const out: Recommendation[] = [];
  for (const w of ordered) {
    if (out.length >= limit) break;
    const watched = watchedOf(w.slug, w.episodes);
    if (watched > 0 && watched < w.episodes) {
      const remaining = w.episodes - watched;
      out.push({
        workSlug: w.slug, shortTitle: w.shortTitle, kind: "continue", remaining,
        reason: w.episodes === 1
          ? `Termina ${w.shortTitle} para fechar este capítulo da rota.`
          : `Continua ${w.shortTitle} — faltam ${remaining} episódio${remaining === 1 ? "" : "s"}.`,
      });
    }
  }
  for (const w of ordered) {
    if (out.length >= limit) break;
    const watched = watchedOf(w.slug, w.episodes);
    if (watched !== 0) continue;
    const prevDone = ordered.filter((o) => o.order < w.order).every((o) => watchedOf(o.slug, o.episodes) >= o.episodes);
    const size = w.episodes === 1 ? "obra única" : `${w.episodes} episódios`;
    out.push({
      workSlug: w.slug, shortTitle: w.shortTitle,
      kind: prevDone ? "next" : "start", remaining: w.episodes,
      reason: prevDone
        ? `${w.shortTitle} é o próximo da tua rota — ${size} pela frente.`
        : `${w.shortTitle} pode ser começado em qualquer altura — ${size}.`,
    });
  }
  return out;
}
