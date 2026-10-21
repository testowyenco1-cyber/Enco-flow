import React from 'react';
import { Plus, RefreshCw, Zap, Layers, AlertTriangle, Lock, CircuitBoard, Menu, X, ChevronDown, Archive, ShieldCheck, Download, Save, LoaderCircle, CheckCircle2, CalendarDays, UsersRound, ListTodo, Database, LayoutDashboard } from 'lucide-react';
import type { UserRoleProfile } from '../types/userRole';
import type { AuthUser } from '../types/auth';
import { UserRoleSelector } from './UserRoleSelector';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewOrder: () => void;
  onNewDoorOrder?: () => void;
  onRefresh: () => void;
  hasPendingChanges: boolean;
  isSavingChanges: boolean;
  onSaveChanges: () => void;
  onOpenArchive: () => void;
  onOpenDatabases: () => void;
  archiveActive: boolean;
  archiveCount: number;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  problemCount?: number;
  activeModule?: 'orders' | 'doors' | 'sn' | 'calendar' | 'actions' | 'dashboard';
  onSelectModule?: (module: 'orders' | 'doors' | 'sn' | 'calendar' | 'actions') => void;
  doorOrdersCount?: number;
  doorOverdueCount?: number;
  currentProfile: UserRoleProfile;
  authUser: AuthUser;
  onLogout: () => void;
  onOpenUserAdmin: () => void;
}

const modules = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'orders', label: 'Zlecenia stacji', Icon: Zap },
  { id: 'actions', label: 'Plan działań', Icon: ListTodo },
  { id: 'doors', label: 'Moduł Drzwi', Icon: Layers },
  { id: 'sn', label: 'Zestawienie SN', Icon: CircuitBoard },
  { id: 'calendar', label: 'Kalendarz wyjazdów', Icon: CalendarDays },
] as const;

const orderFilters = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'urgent', label: 'Wymagające uwagi' },
  { id: 'active', label: 'W realizacji' },
  { id: 'ready', label: 'Gotowe' },
] as const;

export const Header: React.FC<HeaderProps> = ({
  sidebarOpen, onToggleSidebar,
  onNewOrder, onNewDoorOrder, onRefresh, onSaveChanges, hasPendingChanges, isSavingChanges, onOpenArchive, onOpenDatabases, archiveActive, archiveCount,
  activeTab = 'all', onSelectTab, problemCount = 0,
  activeModule = 'orders', onSelectModule,
  doorOrdersCount = 0, doorOverdueCount = 0,
  currentProfile, authUser, onLogout, onOpenUserAdmin,
}) => {
  const selectedModule = modules.find((module) => module.id === activeModule) ?? modules[0];
  const SelectedIcon = archiveActive ? Archive : selectedModule.Icon;

  const navigateModule = (id: 'orders' | 'doors' | 'sn' | 'calendar' | 'actions' | 'dashboard') => {
    onSelectModule?.(id);
    
  };

  const navigateFilter = (id: string) => {
    onSelectTab?.(id);
    
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Zwiń panel boczny' : 'Rozwiń panel boczny'}
          aria-expanded={sidebarOpen}
          aria-controls="enco-navigation-menu"
          className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => navigateModule('orders')}
          className="flex shrink-0 items-center gap-2.5 text-left group"
          title="Przejdź do zleceń stacji"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 group-hover:bg-blue-500">
            <Zap className="w-4 h-4 fill-white" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap leading-tight">ENCO FLOW</span>
            <span className="hidden sm:block text-[10px] text-slate-400 tracking-wide">Stacje transformatorowe</span>
          </span>
        </button>

        <div className="hidden md:block h-7 w-px bg-slate-700" aria-hidden="true" />
        <button
          type="button"
          onClick={onToggleSidebar}
          className="hidden md:inline-flex min-w-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
          title="Wybierz moduł z menu"
        >
          <SelectedIcon className="w-4 h-4 shrink-0 text-blue-300" />
          <span className="truncate font-semibold">{archiveActive ? 'Archiwum zleceń' : selectedModule.label}</span>
          <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
        </button>

        <div className="flex-1 min-w-0" />

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="min-w-0">
            <UserRoleSelector
              currentUser={authUser}
              currentProfile={currentProfile}
              onLogout={onLogout}
              onOpenUserAdmin={onOpenUserAdmin}
            />
          </div>
          {activeModule === 'doors' ? (
            currentProfile.canManageDoors ? (
              <button type="button" onClick={onNewDoorOrder}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 sm:px-3 py-2 text-xs font-bold hover:bg-blue-500 transition-colors"
                title="Nowe zamówienie drzwi">
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">Nowe zamówienie drzwi</span>
              </button>
            ) : <span className="hidden lg:inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="w-3 h-3" />Drzwi: Podgląd</span>
          ) : (
            currentProfile.canCreateOrders ? (
              <button type="button" onClick={onNewOrder}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-2.5 sm:px-3 py-2 text-xs font-bold hover:bg-blue-500 transition-colors"
                title="Nowe zlecenie">
                <Plus className="w-4 h-4 shrink-0" />
                <span className="hidden lg:inline whitespace-nowrap">Nowe zlecenie</span>
              </button>
            ) : <span className="hidden lg:inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="w-3 h-3" />Zlecenia: Podgląd</span>
          )}
        </div>
      </div>

      {sidebarOpen && (
          <nav id="enco-navigation-menu" aria-label="Nawigacja ENCO Flow"
            className="fixed top-16 bottom-0 left-0 z-40 w-[clamp(220px,16vw,280px)] overflow-y-auto border-r border-slate-700 bg-slate-900 p-3 space-y-5">
            <div>
              <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Moduły</p>
              <div className="space-y-1">
                {modules.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => navigateModule(id)}
                    className={`w-full min-w-0 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm transition-colors ${activeModule === id ? 'bg-blue-600 text-white font-bold' : 'text-slate-200 hover:bg-slate-800'}`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>
                    {id === 'doors' && doorOrdersCount > 0 && (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${doorOverdueCount > 0 ? 'bg-rose-700 text-white' : 'bg-slate-700 text-slate-200'}`}>{doorOrdersCount}</span>
                    )}
                    {id === 'orders' && problemCount > 0 && <span className="h-2 w-2 rounded-full bg-rose-400" />}
                  </button>
                ))}
              </div>
            </div>

            <section className="rounded-xl border border-slate-700 bg-slate-800/70 p-3 space-y-2.5">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="text-xl shrink-0" aria-hidden="true">{currentProfile.avatar}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Aktywne konto użytkownika</p>
                  <p className="mt-0.5 text-sm font-bold text-white break-words leading-snug">{currentProfile.name}</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-400 break-words">{currentProfile.department}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-slate-700 pt-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                <p className="min-w-0 text-[11px] leading-snug text-slate-200 break-words">{currentProfile.editScopeSummary}</p>
              </div>
              <div className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${currentProfile.canDownload ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300' : 'border-rose-800 bg-rose-950/50 text-rose-300'}`}>
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>{currentProfile.canDownload ? 'Pobieranie: Włączone' : 'Pobieranie: Zablokowane'}</span>
              </div>
            </section>

            {!archiveActive && activeModule === 'orders' && (
              <div>
                <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Filtry zleceń</p>
                <div className="grid grid-cols-1 gap-2">
                  {orderFilters.map(({ id, label }) => (
                    <button key={id} type="button" onClick={() => navigateFilter(id)}
                      className={`w-full min-w-0 flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${activeTab === id ? 'bg-blue-600/20 text-blue-200 border border-blue-500/60' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:text-white'}`}>
                      <span className="min-w-0 flex-1 break-words leading-snug">{label}</span>{id === 'urgent' && problemCount > 0 && <span className="shrink-0 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-rose-300">{problemCount}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeModule === 'doors' && doorOverdueCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-900 bg-rose-950/60 px-3 py-2 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4" /> {doorOverdueCount} zamówień drzwi po terminie
              </div>
            )}

            <div className="border-t border-slate-700 pt-3 space-y-2">
              <button
                type="button"
                onClick={onSaveChanges}
                disabled={!hasPendingChanges || isSavingChanges}
                aria-live="polite"
                className={`relative w-full min-w-0 flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-bold transition-all ${hasPendingChanges ? 'bg-blue-600 text-white shadow-md shadow-blue-950/40 hover:bg-blue-500' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'}`}
                title={hasPendingChanges ? 'Zapisz niezapisane zmiany na serwerze' : 'Wszystkie zmiany są zapisane'}
              >
                {hasPendingChanges && <span className="absolute left-3 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-red-400/20" aria-label="Niezapisane zmiany" />}
                {isSavingChanges ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : hasPendingChanges ? <Save className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
                <span>{isSavingChanges ? 'Zapisywanie…' : 'Zapisz zmiany'}</span>
              </button>
              <p className={`px-1 text-[11px] leading-snug text-center ${hasPendingChanges ? 'text-rose-300' : 'text-slate-500'}`}>
                {hasPendingChanges ? 'Masz niezapisane zmiany.' : 'Wszystkie zmiany są zapisane.'}
              </p>
            </div>

            <div className="border-t border-slate-700 pt-3">
              <button type="button" onClick={onOpenArchive}
                className={`w-full min-w-0 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm ${archiveActive ? 'bg-blue-600 text-white font-bold' : 'text-slate-200 hover:bg-slate-800'}`}>
                <Archive className="w-4 h-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words leading-snug">Archiwum zleceń</span>
                <span className="text-xs text-slate-400">{archiveCount}</span>
              </button>
              <button type="button" onClick={onOpenDatabases} className="w-full min-w-0 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-200 hover:bg-slate-800"><Database className="w-4 h-4 shrink-0"/><span className="min-w-0 flex-1 break-words leading-snug">Bazy danych</span></button>
              <button type="button" onClick={() => {  onRefresh(); }}
                className="w-full min-w-0 flex items-start gap-3 rounded-lg px-3 py-3 text-left text-sm text-slate-200 hover:bg-slate-800">
                <RefreshCw className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="min-w-0 flex-1 break-words leading-snug">Odśwież dane z serwera</span>
              </button>
              <p className="px-3 text-[11px] text-slate-400">Odświeżenie odrzuci niezapisane zmiany lokalne.</p>
            </div>
          </nav>
      )}
    </header>
  );
};
