import React from 'react';
import { Plus, RotateCcw, RefreshCw, Zap, Layers, AlertTriangle, Lock, CircuitBoard } from 'lucide-react';
import { UserRoleProfile, UserRoleId } from '../types/userRole';
import { UserRoleSelector } from './UserRoleSelector';

interface HeaderProps {
  onNewOrder: () => void;
  onNewDoorOrder?: () => void;
  onResetData: () => void;
  onRefresh: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  problemCount?: number;
  activeModule?: 'orders' | 'doors' | 'sn';
  onSelectModule?: (module: 'orders' | 'doors' | 'sn') => void;
  doorOrdersCount?: number;
  doorOverdueCount?: number;
  currentProfile: UserRoleProfile;
  onSelectProfile: (roleId: UserRoleId) => void;
  onOpenMatrixModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNewOrder,
  onNewDoorOrder,
  onResetData,
  onRefresh,
  activeTab = 'all',
  onSelectTab,
  problemCount = 0,
  activeModule = 'orders',
  onSelectModule,
  doorOrdersCount = 0,
  doorOverdueCount = 0,
  currentProfile,
  onSelectProfile,
  onOpenMatrixModal,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title wordmark & Module Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            onClick={() => onSelectModule && onSelectModule('orders')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-sm tracking-tighter shadow-sm group-hover:bg-blue-500 transition-colors">
              <Zap className="w-4 h-4 fill-white" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-white whitespace-nowrap leading-none">
                  ENCO FLOW
                </span>
                <button
                  type="button"
                  onClick={onRefresh}
                  title="Pobierz aktualne dane z serwera. Niezapisane zmiany lokalne zostaną odrzucone."
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-2.5 h-2.5" />
                  <span>ODŚWIEŻ</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider mt-0.5">
                Stacje Transformatorowe
              </span>
            </div>
          </div>

          {/* Module Switcher Tabs */}
          <div className="hidden sm:flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/60 ml-2">
            <button
              type="button"
              onClick={() => onSelectModule && onSelectModule('orders')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'orders'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Zlecenia stacji</span>
              {problemCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onSelectModule && onSelectModule('doors')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'doors'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Moduł „Drzwi”</span>
              {doorOrdersCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] font-bold rounded-full ${
                    doorOverdueCount > 0
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {doorOrdersCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectModule && onSelectModule('sn')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeModule === 'sn'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <CircuitBoard className="w-3.5 h-3.5 text-cyan-300" />
              <span>Zestawienie SN</span>
            </button>
          </div>
        </div>

        {/* Zone 2: Navigation sub-filters when in orders module */}
        {activeModule === 'orders' ? (
          <nav className="hidden lg:flex items-center gap-5 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('all')}
              className={`transition-colors cursor-pointer py-1 ${
                activeTab === 'all'
                  ? 'text-white border-b-2 border-blue-500 font-bold'
                  : 'hover:text-white'
              }`}
            >
              Wszystkie
            </button>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('urgent')}
              className={`transition-colors cursor-pointer py-1 flex items-center gap-1.5 ${
                activeTab === 'urgent'
                  ? 'text-white border-b-2 border-blue-500 font-bold'
                  : 'hover:text-white'
              }`}
            >
              <span>Wymagające uwagi</span>
              {problemCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('active')}
              className={`transition-colors cursor-pointer py-1 ${
                activeTab === 'active'
                  ? 'text-white border-b-2 border-blue-500 font-bold'
                  : 'hover:text-white'
              }`}
            >
              W realizacji
            </button>
            <button
              type="button"
              onClick={() => onSelectTab && onSelectTab('ready')}
              className={`transition-colors cursor-pointer py-1 ${
                activeTab === 'ready'
                  ? 'text-white border-b-2 border-blue-500 font-bold'
                  : 'hover:text-white'
              }`}
            >
              Gotowe
            </button>
          </nav>
        ) : activeModule === 'doors' ? (
          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Layers className="w-4 h-4" />
              <span>Śledzenie zamówień drzwi PZD</span>
            </span>
            {doorOverdueCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-950/80 border border-rose-800 text-rose-300 rounded text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                {doorOverdueCount} po terminie
              </span>
            )}
          </div>
        ) : (
          <div className="hidden lg:flex items-center gap-2 text-xs text-cyan-200">
            <CircuitBoard className="h-4 w-4" />
            <span>Zestawienie dostaw i stanów magazynowych SN</span>
          </div>
        )}

        {/* Zone 3: User Profile Switcher & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Active User Account Switcher */}
          <UserRoleSelector
            currentProfile={currentProfile}
            onSelectProfile={onSelectProfile}
            onOpenMatrixModal={onOpenMatrixModal}
          />

          {/* Reset Demo Data button (Admin only) */}
          {currentProfile.canResetDemo && (
            <button
              type="button"
              onClick={onResetData}
              title="Przywróć przykładowe dane testowe stacji i drzwi"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap border border-slate-700/60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Dane demo</span>
            </button>
          )}

          {activeModule === 'doors' ? (
            currentProfile.canManageDoors ? (
              <button
                type="button"
                onClick={onNewDoorOrder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nowe zamówienie drzwi</span>
              </button>
            ) : (
              <div
                title={`Profil „${currentProfile.name}” ma uprawnienia tylko do podglądu zamówień drzwi.`}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 rounded-lg select-none cursor-not-allowed"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Drzwi: Podgląd</span>
              </div>
            )
          ) : (
            currentProfile.canCreateOrders ? (
              <button
                type="button"
                onClick={onNewOrder}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Nowe zlecenie</span>
              </button>
            ) : (
              <div
                title={`Tworzenie zleceń dostępne dla profili: Admin oraz Dział Handlowy (aktywny: ${currentProfile.name}).`}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-400 bg-slate-800/80 border border-slate-700 rounded-lg select-none cursor-not-allowed"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Zlecenia: Podgląd</span>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
};
