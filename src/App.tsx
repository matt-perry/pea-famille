/**
 * Coquille de l'app : onglets, pages empilées, feuilles, synchronisation des cours.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconChart, IconList, IconProjection } from './components/icons';
import { setSetting } from './repositories/settings';
import { syncPrices } from './services/prices';
import { AppDataProvider, useAppData } from './viewmodels/AppData';
import { EtfView } from './views/EtfView';
import { HomeView } from './views/HomeView';
import { MovementSheet } from './views/MovementSheet';
import { MovementsView } from './views/MovementsView';
import { NavContext, type Nav, type Page, type SheetState, type Tab } from './views/nav';
import { Onboarding } from './views/Onboarding';
import { PerformanceView } from './views/PerformanceView';
import { ProjectionView } from './views/ProjectionView';
import { AccountSheet, EtfSheet, GoalSheet } from './views/SettingsSheets';
import { MarketView, MethodsView, SettingsView } from './views/SettingsView';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;

export function App() {
  return (
    <AppDataProvider fallback={<div className="screen" aria-busy="true" />}>
      <Shell />
    </AppDataProvider>
  );
}

function Shell() {
  const data = useAppData();
  const [tab, setTab] = useState<Tab>('home');
  const [pages, setPages] = useState<Page[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [covered, setCovered] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const scrollMemory = useRef<number[]>([]);

  // Références à jour pour la synchronisation automatique, sans relancer d'effet à chaque changement.
  const latest = useRef(data);
  latest.current = data;

  const sync = useCallback(async () => {
    const d = latest.current;
    if (!d.settings.dataKey) return;
    setSyncing(true);
    try {
      await syncPrices(d.etfs, d.settings.dataKey, d.settings.dataBaseUrl);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const maybeSync = () => {
      const d = latest.current;
      if (document.visibilityState !== 'visible' || !d.settings.dataKey || d.accounts.length === 0) return;
      if (!d.settings.lastSyncAt || Date.now() - d.settings.lastSyncAt > SYNC_INTERVAL_MS) void sync();
    };
    maybeSync();
    const onVisibility = () => {
      // Masque les montants quand l'app passe en arrière-plan.
      setCovered(document.visibilityState === 'hidden');
      maybeSync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [sync, data.settings.dataKey]);

  const nav: Nav = useMemo(
    () => ({
      tab,
      setTab: (t) => {
        scrollMemory.current = [];
        setPages([]);
        setTab(t);
        window.scrollTo(0, 0);
      },
      push: (page) => {
        scrollMemory.current.push(window.scrollY);
        setPages((p) => [...p, page]);
        window.scrollTo(0, 0);
      },
      pop: () => {
        const y = scrollMemory.current.pop() ?? 0;
        setPages((p) => p.slice(0, -1));
        requestAnimationFrame(() => window.scrollTo(0, y));
      },
      openSheet: setSheet,
      closeSheet: () => setSheet(null),
      toast: (message) => {
        setToast(message);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2600);
      },
      scope: data.settings.scope,
      setScope: (scope) => void setSetting('scope', scope),
      sync,
      syncing,
    }),
    [tab, data.settings.scope, sync, syncing],
  );

  if (data.accounts.length === 0) return <Onboarding />;

  const page = pages[pages.length - 1];

  return (
    <NavContext.Provider value={nav}>
      {page ? (
        <main className="page" key={pages.length}>
          {page.name === 'performance' && <PerformanceView />}
          {page.name === 'etf' && <EtfView etfId={page.etfId} />}
          {page.name === 'settings' && <SettingsView />}
          {page.name === 'market' && <MarketView />}
          {page.name === 'methods' && <MethodsView />}
        </main>
      ) : (
        <main>
          {tab === 'home' && <HomeView />}
          {tab === 'movements' && <MovementsView />}
          {tab === 'projection' && <ProjectionView />}
        </main>
      )}

      {!page && (
        <nav className="tabbar" aria-label="Onglets">
          <div className="tabbar-inner">
            <TabButton active={tab === 'home'} label="Patrimoine" onClick={() => nav.setTab('home')} icon={<IconChart />} />
            <TabButton active={tab === 'movements'} label="Mouvements" onClick={() => nav.setTab('movements')} icon={<IconList />} />
            <TabButton active={tab === 'projection'} label="Projection" onClick={() => nav.setTab('projection')} icon={<IconProjection />} />
          </div>
        </nav>
      )}

      {sheet?.name === 'movement' && <MovementSheet key={sheet.movementId ?? 'new'} movementId={sheet.movementId} />}
      {sheet?.name === 'goal' && <GoalSheet />}
      {sheet?.name === 'etf' && <EtfSheet key={sheet.etfId ?? 'new'} etfId={sheet.etfId} />}
      {sheet?.name === 'account' && <AccountSheet accountId={sheet.accountId} />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {covered && <div className="privacy-cover" />}
    </NavContext.Provider>
  );
}

function TabButton(props: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button className="tab" aria-current={props.active ? 'page' : undefined} onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}
