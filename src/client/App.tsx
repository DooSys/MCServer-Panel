import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Blocks, ChevronRight, CloudSun, Download, ExternalLink, FileText, Gauge, History, ListChecks, LogOut, MessageSquare, Moon, PackageSearch, Play, RefreshCw, Save, Search, Server, Shield, TerminalSquare, Upload, Users } from 'lucide-react';
import { apiFetch, pb, postJson } from './api';
import { localizeRule, normalizeLanguage, profileLabel, t } from './i18n';
import type { Language, TranslationKey } from './i18n';
import type { AddonPackage, CatalogInstallResult, CatalogProject, CatalogProjectType, GameruleState, LogDetection, PlayerSummary, ServerStatus } from '../shared/types';
import { RECOMMENDED_PROFILES } from '../shared/gamerules';

type Page = 'dashboard' | 'console' | 'players' | 'gamerules' | 'addons' | 'catalog' | 'files' | 'logs' | 'settings' | 'users';
type Toast = { type: 'ok' | 'error'; message: string } | null;
type PageProps = { status: ServerStatus | null; setToast: (toast: Toast) => void; refreshStatus: () => Promise<void>; language: Language };

const nav: Array<{ key: Page; label: TranslationKey; icon: typeof Gauge }> = [
  { key: 'dashboard', label: 'navDashboard', icon: Gauge }, { key: 'console', label: 'navConsole', icon: TerminalSquare }, { key: 'players', label: 'navPlayers', icon: Users }, { key: 'gamerules', label: 'navRules', icon: ListChecks }, { key: 'addons', label: 'navAddons', icon: Blocks }, { key: 'catalog', label: 'navCatalog', icon: PackageSearch }, { key: 'files', label: 'navFiles', icon: FileText }, { key: 'logs', label: 'navLogs', icon: History }, { key: 'settings', label: 'navSettings', icon: Server }, { key: 'users', label: 'navUsers', icon: Shield }
];
const commonCommands = ['list', 'save-all', 'say ', 'gamerule keepInventory true', 'whitelist list', 'time set day', 'weather clear', 'difficulty normal'];
const catalogTypeLabels: Record<CatalogProjectType, TranslationKey> = { datapack: 'typeDatapack', plugin: 'typePlugin', mod: 'typeMod', resourcepack: 'typeResourcepack' };

export function App() {
  const [language, setLanguageState] = useState<Language>(() => normalizeLanguage(localStorage.getItem('mc-panel-language')));
  const [page, setPage] = useState<Page>('dashboard');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(true);
  const [loggedIn, setLoggedIn] = useState(pb.authStore.isValid);

  function setLanguage(next: Language) { setLanguageState(next); localStorage.setItem('mc-panel-language', next); }
  async function refreshStatus() { setStatus(await apiFetch<ServerStatus>('/server/status')); }

  useEffect(() => { apiFetch<{ authRequired: boolean }>('/app/config').then((config) => setAuthRequired(config.authRequired)).finally(() => setAuthReady(true)); }, []);
  useEffect(() => pb.authStore.onChange(() => setLoggedIn(pb.authStore.isValid), true), []);
  useEffect(() => { if (!authReady || (authRequired && !loggedIn)) return; refreshStatus().catch((error) => setToast({ type: 'error', message: error.message })); const timer = window.setInterval(() => refreshStatus().catch(() => undefined), 15000); return () => window.clearInterval(timer); }, [authReady, authRequired, loggedIn]);

  if (!authReady) return <div className="boot">{t(language, 'loading')}</div>;
  if (authRequired && !loggedIn) return <Login language={language} setLanguage={setLanguage} />;

  const Current = { dashboard: Dashboard, console: ConsolePage, players: PlayersPage, gamerules: GamerulesPage, addons: AddonsPage, catalog: CatalogPage, files: FilesPage, logs: LogsPage, settings: SettingsPage, users: UsersPage }[page];

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><Server size={24} /><span>MCServer Panel</span></div><nav>{nav.map((item) => { const Icon = item.icon; return <button className={page === item.key ? 'active' : ''} key={item.key} onClick={() => setPage(item.key)}><Icon size={18} />{t(language, item.label)}</button>; })}</nav><button className="ghost bottom" onClick={() => { pb.authStore.clear(); setLoggedIn(false); }}><LogOut size={18} />{t(language, 'logout')}</button></aside><main><TopBar status={status} onRefresh={refreshStatus} language={language} setLanguage={setLanguage} />{toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}<Current status={status} setToast={setToast} refreshStatus={refreshStatus} language={language} /></main></div>;
}

function LanguageSwitch({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return <div className="language-switch"><button className={language === 'fr' ? 'active' : ''} onClick={() => setLanguage('fr')}>FR</button><button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>EN</button></div>;
}

function Login({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const [identity, setIdentity] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); try { await pb.collection('users').authWithPassword(identity, password); } catch (err) { setError(err instanceof Error ? err.message : t(language, 'loginFailed')); } }
  return <div className="login-screen"><form className="login-card" onSubmit={submit}><div className="login-top"><div className="brand big"><Server size={28} /><span>MCServer Panel</span></div><LanguageSwitch language={language} setLanguage={setLanguage} /></div><label>{t(language, 'emailOrUser')}<input value={identity} onChange={(event) => setIdentity(event.target.value)} autoFocus /></label><label>{t(language, 'password')}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>{error && <p className="error-text">{error}</p>}<button className="primary">{t(language, 'login')}</button></form></div>;
}


function updateBadgeLabel(language: Language, status?: ServerStatus['panelUpdate']) {
  if (status?.status === 'update_available') return t(language, 'updateAvailable');
  if (status?.status === 'current') return t(language, 'upToDate');
  return t(language, 'notChecked');
}

function updateBadgeClass(status?: ServerStatus['panelUpdate']) {
  if (status?.status === 'update_available') return 'pill warn';
  if (status?.status === 'current') return 'pill ok';
  return 'pill';
}

function TopBar({ status, onRefresh, language, setLanguage }: { status: ServerStatus | null; onRefresh: () => Promise<void>; language: Language; setLanguage: (language: Language) => void }) {
  return <header className="topbar"><div><p className="eyebrow">{t(language, 'serverRuntime')}</p><h1>{status?.motd || 'Minecraft'}</h1></div><div className="status-strip"><LanguageSwitch language={language} setLanguage={setLanguage} /><a className="header-link" href="/pb/_/" target="_blank">{t(language, 'pbAdmin')}</a><span className={status?.rconOk ? 'pill ok' : 'pill down'}>{status?.rconOk ? 'RCON OK' : 'RCON off'}</span><span className={updateBadgeClass(status?.panelUpdate)}>{t(language, 'panelUpdate')}: {updateBadgeLabel(language, status?.panelUpdate)}</span><span className="pill">{status?.playersOnline ?? 0}/{status?.playersMax ?? '?'} {t(language, 'players')}</span><button className="icon-button" title={t(language, 'refresh')} onClick={() => onRefresh()}><RefreshCw size={18} /></button></div></header>;
}

function Dashboard({ status, setToast, refreshStatus, language }: PageProps) {
  const [say, setSay] = useState('');
  const cards = [
    [t(language, 'state'), status?.online ? t(language, 'online') : t(language, 'offline'), status?.error ?? t(language, 'rconChecked')],
    [t(language, 'serverFlavor'), status?.serverFlavor ?? t(language, 'unknown'), status?.type ?? 'itzg/java'],
    [t(language, 'minecraftVersion'), status?.minecraftVersion ?? t(language, 'unknown'), t(language, 'readFromServerProperties')],
    [t(language, 'navPlayers'), `${status?.playersOnline ?? 0}/${status?.playersMax ?? '?'}`, status?.players.join(', ') || t(language, 'noPlayers')],
    [t(language, 'world'), status?.gameMode ?? t(language, 'unknown'), `${t(language, 'difficulty')} ${status?.difficulty ?? '?'}`],
    [t(language, 'dockerImage'), `${status?.dockerImage ?? 'itzg/minecraft-server'}:${status?.dockerImageTag ?? '?'}`, status?.imageUpdate?.message ?? t(language, 'updateStatus')]
  ];
  async function action(action: string, message?: string) { try { const data = await postJson<{ result: string }>('/server/quick-action', { action, message }); setToast({ type: 'ok', message: data.result || t(language, 'actionDone') }); await refreshStatus(); } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : t(language, 'error') }); } }
  return <section className="page-grid"><div className="metric-grid">{cards.map(([label, value, detail]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div><section className="panel wide"><div className="panel-head"><h2>{t(language, 'quickActions')}</h2><span>{t(language, 'controlledRcon')}</span></div><div className="quick-actions"><button onClick={() => action('save_all')}><Save size={17} />save-all</button><button onClick={() => action('time_day')}><Moon size={17} />{t(language, 'day')}</button><button onClick={() => action('weather_clear')}><CloudSun size={17} />{t(language, 'clearWeather')}</button></div><div className="inline-form"><input placeholder={t(language, 'serverMessage')} value={say} onChange={(event) => setSay(event.target.value)} /><button onClick={() => action('say', say)}><MessageSquare size={17} />{t(language, 'send')}</button></div></section></section>;
}

function ConsolePage({ setToast, language }: PageProps) {
  const [command, setCommand] = useState('list'); const [history, setHistory] = useState<Array<{ command: string; result: string }>>([]);
  async function run(event?: FormEvent) { event?.preventDefault(); try { const data = await postJson<{ result: string }>('/rcon/command', { command }); setHistory((items) => [{ command, result: data.result }, ...items].slice(0, 30)); setCommand(''); } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : t(language, 'commandRejected') }); } }
  return <section className="panel page-panel"><div className="panel-head"><h2>{t(language, 'rconConsole')}</h2><span>{t(language, 'rconConsoleHint')}</span></div><form className="console-input" onSubmit={run}><TerminalSquare size={18} /><input list="commands" value={command} onChange={(event) => setCommand(event.target.value)} /><datalist id="commands">{commonCommands.map((item) => <option key={item} value={item} />)}</datalist><button><Play size={16} />Run</button></form><div className="terminal">{history.map((item, index) => <div key={`${item.command}-${index}`}><b>&gt; {item.command}</b><pre>{item.result || 'OK'}</pre></div>)}</div></section>;
}

function GamerulesPage({ setToast, language }: PageProps) {
  const [rules, setRules] = useState<GameruleState[]>([]); const [loading, setLoading] = useState(true); const [profile, setProfile] = useState(RECOMMENDED_PROFILES[1].key);
  async function load() { setLoading(true); const data = await apiFetch<{ rules: GameruleState[] }>('/gamerules'); setRules(data.rules.map((rule) => localizeRule(language, rule))); setLoading(false); }
  useEffect(() => { load().catch((error) => setToast({ type: 'error', message: error.message })); }, [language]);
  const selectedProfile = RECOMMENDED_PROFILES.find((item) => item.key === profile) ?? RECOMMENDED_PROFILES[0];
  async function apply(key: string, value: string) { try { await postJson(`/gamerules/${key}`, { value }); setToast({ type: 'ok', message: `${key} ${t(language, 'ruleApplied')}` }); await load(); } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : t(language, 'gameruleError') }); } }
  return <section className="panel page-panel"><div className="panel-head"><h2>{t(language, 'worldRules')}</h2><select value={profile} onChange={(event) => setProfile(event.target.value)}>{RECOMMENDED_PROFILES.map((item) => <option key={item.key} value={item.key}>{profileLabel(language, item.key)}</option>)}</select></div>{loading ? <p>{t(language, 'rconRead')}</p> : <div className="rules-list">{rules.map((rule) => { const profiled = (selectedProfile.values as Record<string, string>)[rule.key]; const recommended = profiled ?? rule.recommendedValue; const drift = rule.currentValue !== null && rule.currentValue !== recommended; return <article className="rule" key={rule.key}><div><strong>{rule.label}</strong><code>{rule.key}</code><p>{rule.description}</p></div><span className={drift ? 'pill warn' : 'pill ok'}>{rule.currentValue ?? '?'}</span><RuleInput rule={rule} onApply={(value) => apply(rule.key, value)} language={language} /><button onClick={() => apply(rule.key, recommended)}>{t(language, 'backRecommended')}</button></article>; })}</div>}</section>;
}

function RuleInput({ rule, onApply, language }: { rule: GameruleState; onApply: (value: string) => void; language: Language }) {
  const [value, setValue] = useState(rule.currentValue ?? rule.recommendedValue); useEffect(() => setValue(rule.currentValue ?? rule.recommendedValue), [rule.currentValue, rule.recommendedValue]);
  return <div className="rule-control">{rule.valueType === 'boolean' ? <label className="switch"><input type="checkbox" checked={value === 'true'} onChange={(event) => setValue(String(event.target.checked))} /><span /></label> : <input className="small-input" value={value} onChange={(event) => setValue(event.target.value)} />}<button onClick={() => onApply(value)}>{t(language, 'apply')}</button></div>;
}

function PlayersPage({ setToast, language }: PageProps) {
  const [players, setPlayers] = useState<PlayerSummary | null>(null); const [name, setName] = useState(''); async function load() { setPlayers(await apiFetch<PlayerSummary>('/players')); } useEffect(() => { load().catch((error) => setToast({ type: 'error', message: error.message })); }, []); async function addWhitelist() { await postJson('/players/whitelist', { name }); setName(''); await load(); }
  return <section className="page-grid"><div className="panel"><h2>{t(language, 'connected')}</h2><List names={players?.online ?? []} language={language} /></div><div className="panel"><h2>{t(language, 'whitelist')}</h2><div className="inline-form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t(language, 'nickname')} /><button onClick={() => addWhitelist()}><Users size={16} />{t(language, 'add')}</button></div><List names={(players?.whitelist ?? []).map((item) => String(item.name ?? item.uuid ?? 'joueur'))} language={language} /></div><div className="panel"><h2>Ops</h2><List names={(players?.ops ?? []).map((item) => String(item.name ?? item.uuid ?? 'op'))} language={language} /></div></section>;
}

function AddonsPage({ setToast, language }: PageProps) {
  const [addons, setAddons] = useState<AddonPackage[]>([]); const [datapackList, setDatapackList] = useState(''); async function load() { const data = await apiFetch<{ packages: AddonPackage[]; datapackList: string }>('/addons'); setAddons(data.packages); setDatapackList(data.datapackList); } useEffect(() => { load().catch((error) => setToast({ type: 'error', message: error.message })); }, []);
  async function upload(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const form = new FormData(); form.set('file', file); try { await apiFetch('/addons/upload', { method: 'POST', body: form }); setToast({ type: 'ok', message: t(language, 'datapackUploaded') }); await load(); } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : t(language, 'uploadRejected') }); } }
  return <section className="panel page-panel"><div className="panel-head"><h2>{t(language, 'addonsTitle')}</h2><label className="upload"><Upload size={16} />{t(language, 'uploadZip')}<input type="file" accept=".zip" onChange={upload} /></label></div><pre className="datapack-status">{datapackList || t(language, 'datapackUnavailable')}</pre><div className="addon-grid">{addons.map((addon) => <article className="addon" key={addon.id}><strong>{addon.name}</strong><span className="pill">{addon.type}</span><small>{addon.filename}</small><p>{addon.status}</p></article>)}</div></section>;
}


function CatalogPage({ status, setToast, language }: PageProps) {
  const [query, setQuery] = useState('');
  const [projectType, setProjectType] = useState<'all' | CatalogProjectType>('all');
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [compatibleTypes, setCompatibleTypes] = useState<CatalogProjectType[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  async function load(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '18' });
      if (query.trim()) params.set('query', query.trim());
      if (projectType !== 'all') params.set('projectType', projectType);
      const data = await apiFetch<{ projects: CatalogProject[]; compatibleTypes: CatalogProjectType[] }>(`/catalog/search?${params.toString()}`);
      setProjects(data.projects);
      setCompatibleTypes(data.compatibleTypes);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : t(language, 'catalogLoadError') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(() => undefined); }, [status?.serverFlavor, status?.minecraftVersion, projectType]);

  async function install(project: CatalogProject, confirmReplace = false) {
    setInstalling(project.id);
    try {
      const data = await postJson<CatalogInstallResult>('/catalog/install', { source: project.source, projectId: project.id, projectType: project.projectType, confirmReplace });
      setToast({ type: 'ok', message: `${t(language, 'installed')}: ${data.target}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : t(language, 'error');
      if (!confirmReplace && message.toLowerCase().includes('already exists') && window.confirm(t(language, 'replaceAndInstall'))) {
        await install(project, true);
        return;
      }
      setToast({ type: 'error', message });
    } finally {
      setInstalling(null);
    }
  }

  const typeOptions = ['all', ...(compatibleTypes.length ? compatibleTypes : ['datapack', 'plugin', 'mod'])] as Array<'all' | CatalogProjectType>;

  return <section className="panel page-panel"><div className="panel-head"><div><h2>{t(language, 'catalogTitle')}</h2><span>{t(language, 'catalogHint')} {status?.serverFlavor ?? t(language, 'unknown')} / {status?.minecraftVersion ?? t(language, 'unknown')}</span></div><form className="catalog-toolbar" onSubmit={load}><div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, 'catalogSearch')} /></div><select value={projectType} onChange={(event) => setProjectType(event.target.value as 'all' | CatalogProjectType)}>{typeOptions.map((item) => <option key={item} value={item}>{item === 'all' ? t(language, 'allTypes') : t(language, catalogTypeLabels[item])}</option>)}</select><button><Search size={16} />{t(language, 'filter')}</button></form></div>{loading ? <p className="muted">{t(language, 'loading')}</p> : <div className="catalog-grid">{projects.length ? projects.map((project) => <article className="catalog-card" key={project.id}>{project.iconUrl ? <img src={project.iconUrl} alt="" /> : <PackageSearch size={34} />}<div><div className="catalog-title"><strong>{project.title}</strong><span className="pill">{t(language, catalogTypeLabels[project.projectType])}</span></div><p>{project.description}</p><div className="catalog-meta"><span>{project.downloads.toLocaleString()} {t(language, 'downloads')}</span><span>{project.versions.slice(0, 3).join(', ')}</span></div></div><div className="catalog-actions"><a className="icon-link" href={`https://modrinth.com/${project.projectType}/${project.slug}`} target="_blank" title={t(language, 'openSource')}><ExternalLink size={17} /></a><button disabled={!project.installable || installing === project.id} onClick={() => install(project)} title={project.installWarning ?? t(language, 'install')}><Download size={16} />{project.installable ? t(language, 'install') : t(language, 'incompatible')}</button></div></article>) : <p className="muted">{t(language, 'noResults')}</p>}</div>}</section>;
}

function FilesPage({ setToast, language }: PageProps) {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null); useEffect(() => { apiFetch<Record<string, unknown>>('/files/summary').then(setSummary).catch((error) => setToast({ type: 'error', message: error.message })); }, []);
  return <section className="panel page-panel"><div className="panel-head"><h2>{t(language, 'controlledFiles')}</h2><span>{t(language, 'mcDataReadOnly')}</span></div><pre className="json-view">{JSON.stringify(summary, null, 2)}</pre></section>;
}

function LogsPage({ setToast, language }: PageProps) {
  const [content, setContent] = useState(''); const [detections, setDetections] = useState<LogDetection[]>([]); const [query, setQuery] = useState(''); async function load() { const data = await apiFetch<{ content: string; detections: LogDetection[] }>('/logs/latest'); setContent(data.content); setDetections(data.detections); } useEffect(() => { load().catch((error) => setToast({ type: 'error', message: error.message })); }, []); const filtered = useMemo(() => content.split(/\r?\n/).filter((line) => line.toLowerCase().includes(query.toLowerCase())).join('\n'), [content, query]);
  return <section className="panel page-panel"><div className="panel-head"><h2>{t(language, 'navLogs')}</h2><div className="search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(language, 'filter')} /></div></div><div className="detections">{detections.slice(0, 8).map((item, index) => <span className="pill warn" key={index}>{item.type}</span>)}</div><pre className="log-view">{filtered}</pre></section>;
}

function SettingsPage({ language }: PageProps) { return <section className="panel page-panel"><h2>{t(language, 'serverSettings')}</h2><p>{t(language, 'settingsText')}</p></section>; }
function UsersPage({ language }: PageProps) { return <section className="panel page-panel"><h2>{t(language, 'usersRoles')}</h2><p>{t(language, 'usersText')}</p><a className="button-link" href="/pb/_/" target="_blank">{t(language, 'openPocketBase')}</a></section>; }
function List({ names, language }: { names: string[]; language: Language }) { return <ul className="clean-list">{names.length ? names.map((name) => <li key={name}><ChevronRight size={15} />{name}</li>) : <li className="muted">{t(language, 'noItem')}</li>}</ul>; }
