import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Database,
  Flame,
  Grid2X2,
  History,
  LayoutDashboard,
  ListFilter,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Tv,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";

type View = "dashboard" | "catalogo" | "rota" | "historico" | "preferencias" | "perfil";
type Status = "concluido" | "progresso" | "proximo" | "faltam";
type Universe = "Fuyuki" | "Grand Order" | "Alternativo" | "Prisma☆Illya" | "Comédia";
type Work = {
  id: string;
  title: string;
  shortTitle: string;
  year: string;
  format: "Série" | "Filme" | "Especial" | "OVA";
  episodes: number;
  universe: Universe;
  arc: string;
  order: number;
  color: string;
  description: string;
  badge?: string;
  /** Franquia da obra (multi-anime; null no fallback local). Pronto p/ filtro futuro. */
  franchiseSlug?: string | null;
};

type Activity = { id: string; title: string; detail: string; date: string; kind: "episode" | "title" | "goal" };

const WORKS: Work[] = [
  { id: "ubw", title: "Fate/stay night: Unlimited Blade Works", shortTitle: "Unlimited Blade Works", year: "2014–2015", format: "Série", episodes: 26, universe: "Fuyuki", arc: "Rota principal", order: 1, color: "crimson", description: "A melhor porta de entrada moderna para o conflito de Fuyuki. Acompanha Shirou Emiya e Rin Tohsaka na Guerra do Santo Graal.", badge: "Comece aqui" },
  { id: "hf1", title: "Fate/stay night: Heaven’s Feel I — Presage Flower", shortTitle: "Heaven’s Feel I", year: "2017", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 2, color: "crimson", description: "O primeiro filme da trilogia que aprofunda a rota de Sakura Matou." },
  { id: "hf2", title: "Fate/stay night: Heaven’s Feel II — Lost Butterfly", shortTitle: "Heaven’s Feel II", year: "2019", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 3, color: "crimson", description: "A segunda parte da trilogia cinematográfica de Heaven’s Feel." },
  { id: "hf3", title: "Fate/stay night: Heaven’s Feel III — Spring Song", shortTitle: "Heaven’s Feel III", year: "2020", format: "Filme", episodes: 1, universe: "Fuyuki", arc: "Rota principal", order: 4, color: "crimson", description: "O encerramento da rota principal de Fuyuki em três atos cinematográficos." },
  { id: "zero", title: "Fate/Zero", shortTitle: "Fate/Zero", year: "2011–2012", format: "Série", episodes: 25, universe: "Fuyuki", arc: "Rota principal", order: 5, color: "crimson", description: "O prequel da Quarta Guerra do Santo Graal, melhor aproveitado depois de Heaven’s Feel." },
  { id: "first-order", title: "Fate/Grand Order: First Order", shortTitle: "Grand Order: First Order", year: "2016", format: "Especial", episodes: 1, universe: "Grand Order", arc: "Grand Order", order: 6, color: "teal", description: "A introdução animada à missão da Chaldea para preservar a humanidade." },
  { id: "camelot", title: "Fate/Grand Order: Divine Realm of the Round Table — Camelot", shortTitle: "Grand Order: Camelot", year: "2020–2021", format: "Filme", episodes: 2, universe: "Grand Order", arc: "Grand Order", order: 7, color: "teal", description: "Dois filmes que adaptam a sexta singularidade, com Bedivere e o Rei Leão." },
  { id: "babylonia", title: "Fate/Grand Order: Absolute Demonic Front — Babylonia", shortTitle: "Grand Order: Babylonia", year: "2019–2020", format: "Série", episodes: 21, universe: "Grand Order", arc: "Grand Order", order: 8, color: "teal", description: "A sétima singularidade na antiga Mesopotâmia, com Gilgamesh e a humanidade em risco." },
  { id: "solomon", title: "Fate/Grand Order: Final Singularity — Grand Temple of Time: Solomon", shortTitle: "Grand Order: Solomon", year: "2021", format: "Filme", episodes: 1, universe: "Grand Order", arc: "Grand Order", order: 9, color: "teal", description: "O clímax do primeiro grande arco de Grand Order." },
  { id: "apocrypha", title: "Fate/Apocrypha", shortTitle: "Fate/Apocrypha", year: "2017", format: "Série", episodes: 25, universe: "Alternativo", arc: "Universos alternativos", order: 10, color: "blue", description: "Uma guerra de duas facções, com catorze Servants em confronto." },
  { id: "strange-fake", title: "Fate/strange Fake —Whispers of Dawn—", shortTitle: "Fate/strange Fake", year: "2023", format: "Especial", episodes: 1, universe: "Alternativo", arc: "Universos alternativos", order: 11, color: "blue", description: "Uma Guerra do Santo Graal falsa nos Estados Unidos, com regras próprias." },
  { id: "lord-el-melloi", title: "The Case Files of Lord El-Melloi II", shortTitle: "Lord El-Melloi II", year: "2019", format: "Série", episodes: 13, universe: "Alternativo", arc: "Universos alternativos", order: 12, color: "blue", description: "Waver Velvet resolve mistérios mágicos anos depois dos acontecimentos de Fate/Zero." },
  { id: "prisma", title: "Fate/kaleid liner Prisma☆Illya", shortTitle: "Prisma☆Illya", year: "2013", format: "Série", episodes: 10, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 13, color: "violet", description: "Uma releitura magical girl da franquia com Illya no centro da história." },
  { id: "prisma-2wei", title: "Fate/kaleid liner Prisma☆Illya 2wei!", shortTitle: "Prisma☆Illya 2wei!", year: "2014", format: "Série", episodes: 10, universe: "Prisma☆Illya", arc: "Prisma☆Illya", order: 14, color: "violet", description: "A segunda temporada do spin-off de magical girl." },
  { id: "emiya-menu", title: "Today’s Menu for the Emiya Family", shortTitle: "Today’s Menu", year: "2017–2019", format: "Série", episodes: 13, universe: "Comédia", arc: "Comédia", order: 15, color: "amber", description: "Um spin-off calmo e delicioso sobre a vida quotidiana dos personagens." },
];

const INITIAL_PROGRESS: Record<string, number> = {};
const INITIAL_ACTIVITY: Activity[] = [];

/** Impressão digital dos dados demo do preview — purgada uma vez. Só bate com o
 * estado exato do preview (15 chaves, ubw 14, hf1 1, resto 0). Não há
 * utilizadores reais anteriores ao lançamento, por isso a colisão é desprezável. */
const LEGACY_DEMO_IDS = ["a1", "a2", "a3"];
function isLegacyDemoProgress(p: Record<string, number>): boolean {
  if (Object.keys(p).length !== 15 || p.ubw !== 14 || p.hf1 !== 1) return false;
  return Object.entries(p).every(([k, v]) => typeof v === "number" && (k === "ubw" || k === "hf1" || v === 0));
}
function withoutLegacyDemoProgress(p: Record<string, number>): Record<string, number> {
  return isLegacyDemoProgress(p) ? {} : p;
}
function withoutLegacyDemoActivity(a: Activity[]): Activity[] {
  return a.length === 3 && a.every((item, i) => item.id === LEGACY_DEMO_IDS[i]) ? [] : a;
}

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "rota", label: "Minha rota", icon: Compass },
  { id: "catalogo", label: "Catálogo", icon: BookOpen },
  { id: "historico", label: "Histórico", icon: History },
  { id: "preferencias", label: "Preferências", icon: Settings2 },
  { id: "perfil", label: "Perfil", icon: User },
];

function getStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function statusFor(work: Work, progress: number): Status {
  if (progress >= work.episodes) return "concluido";
  if (progress > 0) return "progresso";
  if (work.order === 1 || work.order === 2) return "proximo";
  return "faltam";
}

function statusLabel(status: Status) {
  return { concluido: "Assistido", progresso: "Em progresso", proximo: "Próximo", faltam: "Em falta" }[status];
}

function getInitials(title: string) { return title.split(/[ :—–]/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase(); }

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const utils = trpc.useUtils();
  const initialPath = typeof window !== "undefined" ? window.location.pathname.replace(/^\//, "") : "";
  const initialView: View = initialPath === "catalogo" || initialPath === "rota" || initialPath === "historico" || initialPath === "preferencias" || initialPath === "perfil" ? initialPath : "dashboard";
  const [view, setView] = useState<View>(initialView);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [localProgress, setLocalProgress] = useState<Record<string, number>>(() => withoutLegacyDemoProgress(getStored("fateflow-progress", INITIAL_PROGRESS)));
  const [localActivity, setLocalActivity] = useState<Activity[]>(() => withoutLegacyDemoActivity(getStored("fateflow-activity", INITIAL_ACTIVITY)));
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | Universe | Status>("todos");
  const [catalogMode, setCatalogMode] = useState<"list" | "map">("list");
  const [route, setRoute] = useState("Rota principal — Fuyuki");
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => { localStorage.setItem("fateflow-progress", JSON.stringify(localProgress)); }, [localProgress]);
  useEffect(() => { localStorage.setItem("fateflow-activity", JSON.stringify(localActivity)); }, [localActivity]);

  // --- Backend (só quando autenticado; modo demo continua em localStorage) ---
  const progressQuery = trpc.progress.list.useQuery(undefined, { enabled: !!user, retry: false, refetchOnWindowFocus: false });
  const activityQuery = trpc.activity.list.useQuery({ limit: 50 }, { enabled: !!user, retry: false, refetchOnWindowFocus: false });
  const prefsQuery = trpc.preferences.get.useQuery(undefined, { enabled: !!user, retry: false, refetchOnWindowFocus: false });
  const catalogQuery = trpc.catalog.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });

  const markMutation = trpc.progress.markEpisode.useMutation({
    onSuccess: () => { utils.progress.list.invalidate(); utils.activity.list.invalidate(); },
    onError: () => { toast.error("Falha ao gravar na conta", { description: "O progresso local foi mantido." }); },
  });
  const migrateMutation = trpc.progress.migrate.useMutation({
    onSuccess: (res) => {
      utils.progress.list.invalidate(); utils.activity.list.invalidate();
      if (res.migrated > 0) toast.success(`Progresso migrado (${res.migrated} obras)`, { description: "A base de dados é agora a fonte principal." });
    },
  });
  const prefsMutation = trpc.preferences.update.useMutation({ onSuccess: () => { utils.preferences.get.invalidate(); } });
  const routesQuery = trpc.routes.list.useQuery(undefined, { enabled: !!user, retry: false, refetchOnWindowFocus: false });
  const setActiveRoute = trpc.routes.setActive.useMutation({ onSuccess: () => { utils.preferences.get.invalidate(); } });
  const clearHistoryMutation = trpc.activity.clear.useMutation({
    onSuccess: () => { utils.activity.list.invalidate(); toast("Histórico limpo"); },
    onError: () => { toast.error("Falha ao limpar o histórico da conta"); },
  });
  const resetAllMutation = trpc.progress.resetAll.useMutation({
    onSuccess: () => {
      utils.progress.list.invalidate(); utils.activity.list.invalidate();
      toast.success("Progresso reposto", { description: "O arquivo voltou ao estado inicial." });
    },
    onError: () => { toast.error("Falha ao repor o progresso da conta"); },
  });
  const [localSmart, setLocalSmart] = useState(true);
  const [localCompact, setLocalCompact] = useState(false);
  const smart = user && prefsQuery.data ? (prefsQuery.data.smartRecommendations ?? true) : localSmart;
  const compact = user && prefsQuery.data ? (prefsQuery.data.compactMode ?? false) : localCompact;
  const handleSmartChange = (value: boolean) => {
    setLocalSmart(value);
    if (user) prefsMutation.mutate({ smartRecommendations: value });
  };
  const handleCompactChange = (value: boolean) => {
    setLocalCompact(value);
    if (user) prefsMutation.mutate({ compactMode: value });
  };
  const handleClearHistory = () => {
    setLocalActivity([]);
    if (user) clearHistoryMutation.mutate();
    else toast("Histórico limpo");
  };
  const handleResetAll = () => {
    setLocalProgress(INITIAL_PROGRESS);
    setLocalActivity(INITIAL_ACTIVITY);
    if (user) resetAllMutation.mutate();
    else toast.success("Progresso reposto", { description: "O arquivo voltou ao estado inicial." });
  };

  // Rota vinda do servidor quando logado (fallback: estado local demo).
  useEffect(() => {
    if (!user || !prefsQuery.data || !routesQuery.data) return;
    const found = routesQuery.data.find((r) => r.id === prefsQuery.data.selectedRouteId);
    if (found && found.name !== route) setRoute(found.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, prefsQuery.data, routesQuery.data]);

  const handleRouteChange = (name: string) => {
    setRoute(name);
    if (user && routesQuery.data) {
      const found = routesQuery.data.find((r) => r.name === name);
      if (found) setActiveRoute.mutate({ routeId: found.id });
    }
  };

  // Migrar localStorage -> conta uma vez por login; depois a DB é a fonte principal.
  useEffect(() => {
    if (!user || migrationDone || progressQuery.isLoading) return;
    setMigrationDone(true);
    const hasLocal = Object.values(localProgress).some((v) => v > 0);
    if (hasLocal) migrateMutation.mutate({ local: localProgress });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, progressQuery.isLoading]);
  useEffect(() => { setMigrationDone(false); }, [user?.openId]);

  // Catálogo do backend quando disponível (fallback: constante local do MVP).
  const worksFromServer: Work[] | null = useMemo(() => {
    const rows = catalogQuery.data;
    if (!rows || rows.length === 0) return null;
    return rows.filter((r) => r.isActive !== false).map((r) => ({
      id: r.slug,
      title: r.title,
      shortTitle: r.shortTitle ?? r.title,
      year: r.year ?? "",
      format: (r.format as Work["format"]) ?? "Série",
      episodes: r.episodeCount ?? 1,
      universe: (r.universe as Universe) ?? "Fuyuki",
      arc: r.arc ?? "",
      order: r.orderIndex ?? 99,
      color: r.color ?? "blue",
      description: r.description ?? "",
      badge: r.badge ?? undefined,
      franchiseSlug: (r as { franchiseSlug?: string | null }).franchiseSlug ?? null,
    }));
  }, [catalogQuery.data]);
  const activeWorks = worksFromServer ?? WORKS;

  const progress: Record<string, number> = user && progressQuery.data ? progressQuery.data : localProgress;
  const activity: Activity[] = useMemo(() => {
    if (user && activityQuery.data) {
      return activityQuery.data.map((a) => ({
        id: String(a.id),
        title: a.work?.shortTitle ?? a.work?.title ?? "FateFlow",
        detail: a.actionType === "work_completed" ? "Obra concluída" : a.actionType === "work_reset" ? "Progresso reiniciado" : a.actionType === "progress_migrated" ? "Migração do progresso local" : "Episódio concluído",
        date: a.createdAt ? new Date(a.createdAt).toLocaleString("pt-BR") : "",
        kind: (a.actionType === "work_completed" ? "title" : "episode") as Activity["kind"],
      }));
    }
    return localActivity;
  }, [user, activityQuery.data, localActivity]);

  const enriched = useMemo(() => activeWorks.map(work => ({ ...work, progress: progress[work.id] ?? 0, status: statusFor(work, progress[work.id] ?? 0) })), [activeWorks, progress]);
  const totalEpisodes = activeWorks.reduce((sum, work) => sum + work.episodes, 0);
  const watchedEpisodes = enriched.reduce((sum, work) => sum + Math.min(work.progress, work.episodes), 0);
  const mainWorks = enriched.filter(work => work.universe === "Fuyuki");
  const current = enriched.find(work => work.status === "progresso") ?? enriched.find(work => work.status === "proximo") ?? enriched[0];
  const overallPercent = Math.round((watchedEpisodes / totalEpisodes) * 100);
  const filteredWorks = enriched.filter(work => {
    const matchesSearch = `${work.title} ${work.universe} ${work.arc}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "todos" || work.universe === filter || work.status === filter;
    return matchesSearch && matchesFilter;
  });

  const updateProgress = (work: Work, value: number, notify = true) => {
    const next = Math.max(0, Math.min(work.episodes, value));
    const prev = progress[work.id] ?? 0;
    // Otimista local (mantém demo funcional offline); servidor confirma quando logado.
    setLocalProgress(prevMap => ({ ...prevMap, [work.id]: next }));
    if (user) markMutation.mutate({ workSlug: work.id, watchedEpisodes: next });
    if (next > prev) {
      const detail = work.episodes === 1 ? "Marcado como assistido" : `Episódio ${next} concluído`;
      const kind: Activity["kind"] = work.episodes === 1 ? "title" : "episode";
      if (!user) setLocalActivity(prevA => [{ id: `${Date.now()}`, title: work.shortTitle, detail, date: "Agora", kind }, ...prevA].slice(0, 10));
      if (notify) toast.success(work.episodes === 1 ? `${work.shortTitle} concluído` : `Episódio ${next} marcado como visto`, { description: user ? "A gravar na sua conta." : "Guardado neste navegador (modo demo)." });
    }
  };

  const navigate = (nextView: View) => { setView(nextView); setMobileMenu(false); window.history.pushState({}, "", nextView === "dashboard" ? "/" : `/${nextView}`); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // Sem sessão: página de boas-vindas (sem dados demo, só login Google).
  // Durante a verificação da sessão mostra-se a mesma página em loading,
  // para nunca haver flash do dashboard vazio.
  if (!user) {
    return <Welcome loading={authLoading} onLogin={() => { try { startLogin(); } catch { toast.error("Login indisponível neste ambiente"); } }} />;
  }

  return (
    <div className="app-shell">
      <aside className={`side-rail ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand-lockup" onClick={() => navigate("dashboard")} role="button" tabIndex={0}>
          <div className="brand-mark"><span>F</span><i /></div>
          <div><div className="brand-name">Fate<span>Flow</span></div><div className="brand-caption">WATCH TRACKER</div></div>
        </div>
        <div className="rail-section-label">Acompanhar</div>
        <nav className="rail-nav">
          {NAV_ITEMS.map(item => { const Icon = item.icon; return <button key={item.id} className={`rail-link ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><Icon size={18} /><span>{item.label}</span>{item.id === "rota" && <b className="nav-count">5</b>}</button>; })}
        </nav>
        <div className="rail-divider" />
        <div className="rail-section-label">Atalhos</div>
        <button className="rail-link subtle" onClick={() => { setFilter("progresso"); navigate("catalogo"); }}><Play size={17} /><span>Continuar a ver</span></button>
        <button className="rail-link subtle" onClick={() => { setFilter("faltam"); navigate("catalogo"); }}><Target size={17} /><span>Em falta</span></button>
        <div className="rail-bottom-card"><div className="mini-sigil"><Sparkles size={15} /></div><strong>O seu arquivo mágico</strong><span>{user ? `Conta: ${user.name ?? user.email ?? "ligada"}` : "A verificar sessão..."}</span><div className="storage-bar"><i style={{ width: `${Math.max(24, overallPercent)}%` }} /></div><small>{overallPercent}% da rota explorada</small><button className="soft-button" style={{ marginTop: 8 }} onClick={() => navigate("perfil")}><User size={15} /> O meu perfil</button></div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div className="breadcrumb"><span>FateFlow</span><ChevronRight size={15} /><strong>{NAV_ITEMS.find(item => item.id === view)?.label ?? "Dashboard"}</strong></div>
          <div className="topbar-actions"><button className="top-icon" aria-label="Ajuda"><CircleHelp size={19} /></button><button className="top-icon has-dot" aria-label="Notificações"><Zap size={18} /></button><button className="avatar" title={`${user.name ?? user.email ?? "Conta ligada"} — abrir perfil`} onClick={() => navigate("perfil")}>{(user.name ?? user.email ?? "FF").slice(0, 2).toUpperCase()}</button></div>
        </header>

        <main className="page-content">
          {view === "dashboard" && <Dashboard current={current} enriched={enriched} overallPercent={overallPercent} watchedEpisodes={watchedEpisodes} totalEpisodes={totalEpisodes} activity={activity} onContinue={() => setSelectedWork(current)} onNavigate={navigate} onMark={() => updateProgress(current, (progress[current.id] ?? 0) + 1)} />}
          {view === "catalogo" && <Catalog filteredWorks={filteredWorks} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} catalogMode={catalogMode} setCatalogMode={setCatalogMode} onSelect={setSelectedWork} progress={progress} />}
          {view === "rota" && <RouteView works={mainWorks} route={route} setRoute={handleRouteChange} onSelect={setSelectedWork} progress={progress} onMark={updateProgress} />}
          {view === "historico" && <HistoryView activity={activity} onClear={handleClearHistory} />}
          {view === "preferencias" && <Preferences route={route} setRoute={handleRouteChange} smart={smart} compact={compact} onSmartChange={handleSmartChange} onCompactChange={handleCompactChange} onReset={handleResetAll} />}
          {view === "perfil" && <ProfileView user={user} overallPercent={overallPercent} watchedEpisodes={watchedEpisodes} totalEpisodes={totalEpisodes} doneCount={enriched.filter(work => work.status === "concluido").length} activityCount={activity.length} onOpenPreferences={() => navigate("preferencias")} onLogout={async () => { await logout(); navigate("dashboard"); }} />}
        </main>
      </div>

      <nav className="mobile-nav">{NAV_ITEMS.slice(0, 4).map(item => { const Icon = item.icon; return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={19} /><span>{item.label === "Dashboard" ? "Início" : item.label.split(" ")[0]}</span></button>; })}</nav>

      {selectedWork && <WorkSheet work={selectedWork} progress={progress[selectedWork.id] ?? 0} onClose={() => setSelectedWork(null)} onUpdate={(value) => updateProgress(selectedWork, value)} />}
    </div>
  );
}

function Welcome({ loading, onLogin }: { loading: boolean; onLogin: () => void }) {
  const totalItems = WORKS.reduce((sum, work) => sum + work.episodes, 0);
  const steps = [
    { icon: LogIn, title: "Entra com Google", text: "Uma conta, sem passwords. O teu arquivo fica guardado e sincronizado." },
    { icon: Compass, title: "Escolhe a tua rota", text: "Fuyuki, Grand Order, Prisma☆Illya ou exploração livre — pela ordem certa." },
    { icon: Play, title: "Marca episódios e filmes", text: "Um toque por episódio. O FateFlow calcula o resto." },
    { icon: BarChart3, title: "Vê o arquivo crescer", text: "Progresso, histórico e próximas obras em qualquer dispositivo." },
  ];
  return (
    <div className="app-shell">
      <div className="main-area" style={{ margin: "0 auto", maxWidth: 880 }}>
        <main className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><Sparkles size={14} /> FATEFLOW · ANIME WATCH TRACKER</div>
              <h1>O teu arquivo da Guerra do Santo Graal<span className="heading-dot">.</span></h1>
              <p>O FateFlow organiza a franquia Fate em rotas ordenadas e regista o teu progresso episódio a episódio. Sem dados de demonstração: começas do zero e tudo o que marcares é teu.</p>
            </div>
          </section>
          <section className="hero-card">
            <div className="hero-glow" /><div className="hero-sigil"><span>F</span><i /><b>✦</b></div>
            <div className="hero-content">
              <div className="hero-kicker">COMEÇA AQUI</div>
              <h2>15 obras · 4 rotas · {totalItems} episódios e filmes</h2>
              <p>Da porta de entrada Unlimited Blade Works ao clímax de Solomon — sempre a saber o que ver a seguir.</p>
              <div className="hero-actions">
                <button className="hero-play" onClick={onLogin} disabled={loading}><LogIn size={17} /> {loading ? "A ligar..." : "Continuar com Google"}</button>
              </div>
            </div>
          </section>
          <section className="stats-row">
            {steps.map((step, i) => { const Icon = step.icon; return <div className="metric-card blue" key={step.title}><div className="metric-icon"><Icon size={18} /></div><div className="metric-copy"><span>PASSO {i + 1}</span><strong>{step.title}</strong><small>{step.text}</small></div></div>; })}
          </section>
          <section className="smart-tip"><div className="tip-icon"><Sparkles size={18} /></div><div><strong>Privacidade primeiro</strong><p>Só guardamos o essencial da tua conta Google (nome e email) e o teu progresso. Nada é partilhado.</p></div><button onClick={onLogin} disabled={loading}>Entrar <ArrowRight size={15} /></button></section>
        </main>
      </div>
    </div>
  );
}

function Dashboard({ current, enriched, overallPercent, watchedEpisodes, totalEpisodes, activity, onContinue, onNavigate, onMark }: { current: Work & { progress: number; status: Status }; enriched: (Work & { progress: number; status: Status })[]; overallPercent: number; watchedEpisodes: number; totalEpisodes: number; activity: Activity[]; onContinue: () => void; onNavigate: (view: View) => void; onMark: () => void }) {
  const doneMain = enriched.filter(work => work.universe === "Fuyuki" && work.status === "concluido").length;
  return <>
    <section className="page-heading"><div><div className="eyebrow"><Sparkles size={14} /> ARQUIVO PESSOAL · ROTA FUYUKI</div><h1>Boa noite<span className="heading-dot">.</span></h1><p>O próximo capítulo está à sua espera. Continue a sua jornada pelo Graal.</p></div><div className="heading-actions"><button className="soft-button"><Star size={16} /> {watchedEpisodes > 0 ? "3 dias seguidos" : "Começa hoje"}</button><button className="primary-button" onClick={onContinue}><Play size={16} fill="currentColor" /> Continuar</button></div></section>
    <section className="hero-card">
      <div className="hero-glow" /><div className="hero-sigil"><span>F</span><i /><b>✦</b></div>
      <div className="hero-content"><div className="hero-kicker">A SEGUIR NA SUA ROTA <span>•</span> EPISÓDIO {current.progress + 1}</div><h2>{current.shortTitle}</h2><p>{current.description}</p><div className="hero-meta"><span><Tv size={15} /> {current.format}</span><span><Clock3 size={15} /> {current.episodes} {current.episodes === 1 ? "filme/especial" : "episódios"}</span><span className="hero-status"><span className="live-dot" /> Em progresso</span></div><div className="hero-actions"><button className="hero-play" onClick={onContinue}><Play size={17} fill="currentColor" /> Retomar episódio {current.progress + 1}</button><button className="hero-more" onClick={onContinue}><MoreHorizontal size={20} /></button></div></div>
      <div className="hero-progress"><div className="progress-ring" style={{ "--progress": `${Math.round((current.progress / current.episodes) * 100)}%` } as React.CSSProperties}><strong>{Math.round((current.progress / current.episodes) * 100)}<small>%</small></strong><span>completo</span></div><div className="hero-progress-copy"><span>Progresso da obra</span><strong>{current.progress} <em>/ {current.episodes}</em></strong><button onClick={onMark}>{current.progress >= current.episodes ? "Concluído" : "Marcar como visto"} <Check size={14} /></button></div></div>
    </section>
    <section className="stats-row">
      <Metric icon={<BarChart3 />} label="Progresso total" value={`${overallPercent}%`} detail={`${watchedEpisodes} de ${totalEpisodes} itens`} accent="blue" />
      <Metric icon={<Flame />} label="Sequência atual" value={watchedEpisodes > 0 ? "3 dias" : "0 dias"} detail={watchedEpisodes > 0 ? "O seu melhor: 7 dias" : "Marca o primeiro episódio"} accent="amber" />
      <Metric icon={<Target />} label="Rota Fuyuki" value={`${doneMain}/5`} detail="obras concluídas" accent="red" />
      <Metric icon={<Clock3 />} label="Tempo estimado" value="18h 40m" detail="para terminar a rota" accent="violet" />
    </section>
    <div className="content-grid dashboard-grid">
      <section className="panel next-panel"><div className="panel-head"><div><div className="eyebrow">ORDEM DA SUA ROTA</div><h2>Próximos capítulos</h2></div><button className="text-button" onClick={() => onNavigate("rota")}>Ver rota completa <ArrowRight size={15} /></button></div><div className="next-list">{enriched.filter(work => work.universe === "Fuyuki").slice(0, 4).map((work, index) => <WorkRow key={work.id} work={work} rank={index + 1} onClick={() => onContinue()} />)}</div></section>
      <section className="panel activity-panel"><div className="panel-head"><div><div className="eyebrow">REGISTRO RECENTE</div><h2>Última atividade</h2></div><button className="icon-quiet" onClick={() => onNavigate("historico")}><ArrowRight size={17} /></button></div><div className="activity-list">{activity.slice(0, 3).map(item => <ActivityRow key={item.id} item={item} />)}</div><button className="panel-footer-button" onClick={() => onNavigate("historico")}>Abrir histórico completo <ChevronRight size={15} /></button></section>
    </div>
    {watchedEpisodes === 0 ? (
      <section className="smart-tip"><div className="tip-icon"><Sparkles size={18} /></div><div><strong>O teu arquivo está vazio</strong><p>Abre uma obra no catálogo e marca o primeiro episódio — o FateFlow trata do resto.</p></div><button onClick={() => onNavigate("catalogo")}>Abrir catálogo <ArrowRight size={15} /></button></section>
    ) : (
      <section className="smart-tip"><div className="tip-icon"><Sparkles size={18} /></div><div><strong>Sugestão do FateFlow</strong><p>Está a 2 episódios de fechar o seu primeiro arco. Uma sessão de 48 min leva-o diretamente ao confronto final de Unlimited Blade Works.</p></div><button onClick={onContinue}>Ver sugestão <ArrowRight size={15} /></button></section>
    )}
  </>;
}

function Metric({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: string; detail: string; accent: string }) { return <div className={`metric-card ${accent}`}><div className="metric-icon">{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>; }

function WorkRow({ work, rank, onClick }: { work: Work & { progress: number; status: Status }; rank: number; onClick: () => void }) { const percent = Math.round((work.progress / work.episodes) * 100); return <button className="work-row" onClick={onClick}><div className={`rank rank-${rank}`}>{String(rank).padStart(2, "0")}</div><div className={`work-cover ${work.color}`}><span>{getInitials(work.title)}</span></div><div className="work-row-copy"><strong>{work.shortTitle}</strong><span>{work.format} · {work.year} {work.status === "progresso" && `· episódio ${work.progress + 1}`}</span></div><div className="row-progress"><div><i style={{ width: `${percent}%` }} /></div><span>{work.progress}/{work.episodes}</span></div><ChevronRight size={17} className="row-chevron" /></button>; }

function ActivityRow({ item }: { item: Activity }) { return <div className="activity-row"><div className={`activity-icon ${item.kind}`}>{item.kind === "episode" ? <Play size={13} fill="currentColor" /> : item.kind === "goal" ? <Target size={14} /> : <Check size={14} />}</div><div><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.date}</time></div>; }

function Catalog({ filteredWorks, search, setSearch, filter, setFilter, catalogMode, setCatalogMode, onSelect, progress }: { filteredWorks: (Work & { progress: number; status: Status })[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: "todos" | Universe | Status) => void; catalogMode: "list" | "map"; setCatalogMode: (mode: "list" | "map") => void; onSelect: (work: Work) => void; progress: Record<string, number> }) { return <>
  <section className="page-heading compact"><div><div className="eyebrow"><BookOpen size={14} /> BIBLIOTECA COMPLETA</div><h1>Catálogo Fate<span className="heading-dot">.</span></h1><p>Pesquise, filtre e abra qualquer obra do arquivo.</p></div><div className="view-toggle"><button className={catalogMode === "list" ? "active" : ""} onClick={() => setCatalogMode("list")}><ListFilter size={16} /> Lista</button><button className={catalogMode === "map" ? "active" : ""} onClick={() => setCatalogMode("map")}><Grid2X2 size={16} /> Mapa</button></div></section>
  <div className="catalog-toolbar"><label className="search-field"><Search size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar obra, universo ou rota..." /><kbd>⌘ K</kbd></label><div className="filter-pills"><button className={filter === "todos" ? "active" : ""} onClick={() => setFilter("todos")}>Todos <span>{WORKS.length}</span></button>{(["Fuyuki", "Grand Order", "Alternativo", "Prisma☆Illya", "Comédia"] as const).map(value => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
  {catalogMode === "map" ? <CatalogMap onSelect={onSelect} progress={progress} /> : <section className="catalog-grid">{filteredWorks.length ? filteredWorks.map(work => <CatalogCard key={work.id} work={work} onSelect={() => onSelect(work)} />) : <div className="empty-state"><Search size={28} /><h3>Nenhuma obra encontrada</h3><p>Tente outro título, universo ou remova os filtros.</p><button onClick={() => { setSearch(""); setFilter("todos"); }}>Limpar filtros</button></div>}</section>}
</>; }

function CatalogCard({ work, onSelect }: { work: Work & { progress: number; status: Status }; onSelect: () => void }) { const percent = Math.round((work.progress / work.episodes) * 100); return <button className="catalog-card" onClick={onSelect}><div className={`catalog-art ${work.color}`}><div className="art-stars">✦ · ✧</div><strong>{getInitials(work.title)}</strong><span>{work.universe}</span><div className="art-orbit" /></div><div className="catalog-copy"><div className="card-topline"><span className={`status-chip ${work.status}`}>{statusLabel(work.status)}</span><span>{work.year}</span></div><h3>{work.shortTitle}</h3><p>{work.format} · {work.episodes} {work.episodes === 1 ? "item" : "episódios"}</p><div className="card-progress"><div><i style={{ width: `${percent}%` }} /></div><span>{percent}%</span></div></div><ChevronRight className="catalog-arrow" size={18} /></button>; }

function CatalogMap({ onSelect, progress }: { onSelect: (work: Work) => void; progress: Record<string, number> }) { const groups = [{ name: "Rota principal", universe: "Fuyuki" as Universe, color: "crimson" }, { name: "Grand Order", universe: "Grand Order" as Universe, color: "teal" }, { name: "Universos alternativos", universe: "Alternativo" as Universe, color: "blue" }]; return <section className="map-panel"><div className="map-intro"><div><div className="eyebrow">NAVEGAÇÃO POR RELAÇÕES</div><h2>O arquivo em forma de mapa</h2><p>A faixa vermelha é o caminho recomendado. Os outros ramos podem ser explorados livremente.</p></div><div className="map-legend"><span className="dot red" /> rota principal <span className="dot blue" /> alternativos <span className="dot teal" /> Grand Order</div></div><div className="constellation-map"><div className="map-center"><span>F</span><small>FATEFLOW</small></div>{groups.map((group, groupIndex) => <div key={group.name} className={`map-branch branch-${groupIndex}`}><div className={`branch-line ${group.color}`} /><div className="branch-head"><span className={`branch-orb ${group.color}`}>{groupIndex + 1}</span><strong>{group.name}</strong><small>{WORKS.filter(work => work.universe === group.universe).length} obras</small></div><div className="branch-works">{WORKS.filter(work => work.universe === group.universe).map(work => { const pct = Math.round(((progress[work.id] ?? 0) / work.episodes) * 100); return <button key={work.id} onClick={() => onSelect(work)}><span className={`mini-cover ${work.color}`}>{getInitials(work.title)}</span><span><b>{work.shortTitle}</b><small>{work.format} · {pct}%</small></span><ChevronRight size={15} /></button>; })}</div></div>)}</div><div className="map-reference"><img src="/fate-map-reference.png" alt="Mapa visual original da franquia Fate" /><div><strong>Mapa de referência</strong><p>Consulte a visão geral original sempre que quiser relembrar as ramificações.</p></div></div></section>; }

function RouteView({ works, route, setRoute, onSelect, progress, onMark }: { works: (Work & { progress: number; status: Status })[]; route: string; setRoute: (value: string) => void; onSelect: (work: Work) => void; progress: Record<string, number>; onMark: (work: Work, value: number) => void }) { const done = works.filter(work => work.status === "concluido").length; const current = works.find(work => work.status === "progresso") ?? works.find(work => work.status === "proximo")!; return <>
  <section className="page-heading compact"><div><div className="eyebrow"><Compass size={14} /> A SUA JORNADA</div><h1>Minha rota<span className="heading-dot">.</span></h1><p>Uma linha do tempo viva — cada marca abre o próximo portal.</p></div><select className="route-select" value={route} onChange={event => setRoute(event.target.value)}><option>Rota principal — Fuyuki</option><option>Grand Order — Singularidades</option><option>Prisma☆Illya — Ordem completa</option></select></section>
  <section className="route-summary"><div className="route-emblem"><Compass size={27} /></div><div><span>ROTA ATUAL</span><h2>{route}</h2><p>{done} de {works.length} obras concluídas · Próximo objetivo: {current?.shortTitle}</p></div><div className="route-summary-progress"><strong>{Math.round((works.reduce((sum, work) => sum + Math.min(work.progress, work.episodes), 0) / works.reduce((sum, work) => sum + work.episodes, 0)) * 100)}%</strong><span>explorado</span></div></section>
  <section className="route-timeline">{works.map((work, index) => <div className={`timeline-item ${work.status}`} key={work.id}><div className="timeline-rail"><span>{work.status === "concluido" ? <Check size={15} /> : String(index + 1).padStart(2, "0")}</span></div><button className="timeline-card" onClick={() => onSelect(work)}><div className={`timeline-art ${work.color}`}>{work.status === "concluido" ? <Check size={24} /> : <span>{getInitials(work.title)}</span>}</div><div className="timeline-copy"><div><span className={`status-chip ${work.status}`}>{statusLabel(work.status)}</span><span className="timeline-format">{work.format} · {work.year}</span></div><h3>{work.title}</h3><p>{work.description}</p><div className="timeline-progress"><div><i style={{ width: `${Math.round((work.progress / work.episodes) * 100)}%` }} /></div><span>{work.progress}/{work.episodes}</span></div></div><ChevronRight size={18} /></button>{work.status === "progresso" && <button className="timeline-quick" onClick={(event) => { event.stopPropagation(); onMark(work, work.progress + 1); }}><Plus size={14} /> marcar próximo</button>}</div>)}</section>
</>; }

function HistoryView({ activity, onClear }: { activity: Activity[]; onClear: () => void }) { return <><section className="page-heading compact"><div><div className="eyebrow"><History size={14} /> REGISTRO DE JORNADA</div><h1>Histórico<span className="heading-dot">.</span></h1><p>Tudo o que marcou no seu arquivo, numa só linha do tempo.</p></div>{activity.length > 0 && <button className="soft-button" onClick={onClear}><X size={15} /> Limpar histórico</button>}</section><section className="history-panel"><div className="history-summary"><div><strong>{activity.length}</strong><span>ações recentes</span></div><div><strong>3</strong><span>dias seguidos</span></div><div><strong>64%</strong><span>ritmo semanal</span></div></div><div className="history-list">{activity.length ? activity.map(item => <div className="history-item" key={item.id}><div className={`history-marker ${item.kind}`} /> <div className="history-date">{item.date}</div><div className="history-detail"><strong>{item.title}</strong><span>{item.detail}</span></div><button className="icon-quiet"><ChevronRight size={17} /></button></div>) : <div className="empty-state"><History size={28} /><h3>O seu histórico está limpo</h3><p>Quando marcar um episódio, a atividade aparece aqui.</p></div>}</div></section></>; }

function ProfileView({ user, overallPercent, watchedEpisodes, totalEpisodes, doneCount, activityCount, onOpenPreferences, onLogout }: { user: { name?: string | null; email?: string | null; loginMethod?: string | null; createdAt?: Date | string; lastSignedIn?: Date | string }; overallPercent: number; watchedEpisodes: number; totalEpisodes: number; doneCount: number; activityCount: number; onOpenPreferences: () => void; onLogout: () => void }) {
  const initials = (user.name ?? user.email ?? "FF").slice(0, 2).toUpperCase();
  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "—";
  const lastSeen = user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "—";
  return <>
    <section className="page-heading compact"><div><div className="eyebrow"><User size={14} /> CONTA</div><h1>Perfil<span className="heading-dot">.</span></h1><p>Os teus dados e a tua sessão neste arquivo.</p></div></section>
    <section className="route-summary"><div className="route-emblem"><span style={{ fontSize: 24, fontWeight: 700 }}>{initials}</span></div><div><span>CONTA LIGADA</span><h2>{user.name ?? "Mago sem nome"}</h2><p>{user.email ?? "Sem email"} · via {user.loginMethod === "google" ? "Google" : (user.loginMethod ?? "conta")}</p></div><div className="route-summary-progress"><strong>{overallPercent}%</strong><span>explorado</span></div></section>
    <section className="stats-row">
      <Metric icon={<BarChart3 />} label="Progresso total" value={`${overallPercent}%`} detail={`${watchedEpisodes} de ${totalEpisodes} itens`} accent="blue" />
      <Metric icon={<Check />} label="Obras concluídas" value={`${doneCount}`} detail="neste arquivo" accent="red" />
      <Metric icon={<History />} label="Ações registadas" value={`${activityCount}`} detail="no histórico" accent="violet" />
    </section>
    <section className="settings-layout">
      <div className="settings-card"><div className="settings-title"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h2>Sessão e conta</h2><p>Membro desde {memberSince} · última visita {lastSeen}.</p></div></div><div className="settings-field"><button className="soft-button" onClick={onOpenPreferences}><Settings2 size={15} /> Abrir preferências</button></div></div>
      <div className="settings-card danger-card"><div className="settings-title"><div className="settings-icon"><LogOut size={18} /></div><div><h2>Terminar sessão</h2><p>O progresso fica guardado na tua conta para a próxima visita.</p></div></div><button className="danger-button" onClick={onLogout}>Sair da conta</button></div>
    </section>
  </>;
}

function Preferences({ route, setRoute, smart, compact, onSmartChange, onCompactChange, onReset }: { route: string; setRoute: (value: string) => void; smart: boolean; compact: boolean; onSmartChange: (value: boolean) => void; onCompactChange: (value: boolean) => void; onReset: () => void }) { return <><section className="page-heading compact"><div><div className="eyebrow"><Settings2 size={14} /> CONTROLO DO ARQUIVO</div><h1>Preferências<span className="heading-dot">.</span></h1><p>Afine a experiência ao seu ritmo de visualização.</p></div></section><section className="settings-layout"><div className="settings-card"><div className="settings-title"><div className="settings-icon"><Compass size={18} /></div><div><h2>Rota principal</h2><p>Escolha a jornada que aparece no dashboard.</p></div></div><div className="settings-field"><label>Ordem de visualização</label><select value={route} onChange={event => setRoute(event.target.value)}><option>Rota principal — Fuyuki</option><option>Grand Order — Singularidades</option><option>Prisma☆Illya — Ordem completa</option></select></div></div><div className="settings-card"><div className="settings-title"><div className="settings-icon"><Sparkles size={18} /></div><div><h2>Assistente FateFlow</h2><p>Pequenas sugestões baseadas no seu progresso.</p></div></div><SettingToggle label="Recomendações inteligentes" description="Sugerir o próximo título e sessões curtas." checked={smart} onChange={onSmartChange} /><SettingToggle label="Modo compacto" description="Mostrar mais itens por ecrã no catálogo." checked={compact} onChange={onCompactChange} /></div><div className="settings-card danger-card"><div className="settings-title"><div className="settings-icon"><Database size={18} /></div><div><h2>Dados do arquivo</h2><p>O progresso fica guardado na tua conta e sincroniza entre dispositivos.</p></div></div><button className="danger-button" onClick={onReset}>Repor progresso inicial</button></div></section></>; }

function SettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="setting-toggle"><div><strong>{label}</strong><span>{description}</span></div><button type="button" className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}><i /></button></label>; }

function WorkSheet({ work, progress, onClose, onUpdate }: { work: Work; progress: number; onClose: () => void; onUpdate: (value: number) => void }) { const pct = Math.round((progress / work.episodes) * 100); return <div className="sheet-backdrop" onClick={onClose}><aside className="work-sheet" onClick={event => event.stopPropagation()}><button className="sheet-close" onClick={onClose}><X size={19} /></button><div className={`sheet-art ${work.color}`}><div className="art-stars">✦ · ✧ · ✦</div><strong>{getInitials(work.title)}</strong><span>{work.universe}</span></div><div className="sheet-body"><div className="card-topline"><span className={`status-chip ${statusFor(work, progress)}`}>{statusLabel(statusFor(work, progress))}</span><span>{work.year} · {work.format}</span></div><h2>{work.title}</h2><p>{work.description}</p><div className="sheet-stats"><div><strong>{work.episodes}</strong><span>{work.episodes === 1 ? "item" : "episódios"}</span></div><div><strong>{pct}%</strong><span>completo</span></div><div><strong>{work.order}</strong><span>na rota</span></div></div><div className="sheet-progress"><div className="sheet-progress-head"><strong>O seu progresso</strong><span>{progress} de {work.episodes}</span></div><div className="big-progress"><i style={{ width: `${pct}%` }} /></div></div><div className="sheet-actions"><button className="primary-button" onClick={() => onUpdate(Math.min(work.episodes, progress + 1))}>{progress >= work.episodes ? <><Check size={16} /> Concluído</> : <><Play size={16} fill="currentColor" /> Marcar {work.episodes === 1 ? "como visto" : `episódio ${progress + 1}`}</>}</button><button className="soft-button" onClick={() => onUpdate(0)}>Recomeçar</button></div></div></aside></div>; }
