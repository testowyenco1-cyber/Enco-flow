import React, { useState, useMemo } from 'react';
import {
  DoorOrder,
  formatPLN,
  formatDatePL,
  checkDoorOrderOverdue,
  Order,
} from '../types/enco';
import {
  Search,
  Plus,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Tag,
  DollarSign,
  FileText,
  Building2,
  Layers,
  ArrowRight,
  ExternalLink,
  LayoutGrid,
  Table as TableIcon,
  CheckSquare,
  Info,
  Lock,
  FolderOpen,
} from 'lucide-react';
import { isSameOrderNumber } from '../utils/orderNumberUtils';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';
import { OrderFilesModal } from './OrderFilesModal';

interface DoorOrdersViewProps {
  doorOrders: DoorOrder[];
  orders: Order[];
  onAddDoorOrder: () => void;
  onOpenDoorOrder?: (order: DoorOrder) => void;
  onEditDoorOrder: (order: DoorOrder) => void;
  onDeleteDoorOrder: (id: string) => void;
  onQuickConfirmDelivery: (order: DoorOrder) => void;
  onNavigateToOrder?: (orderId: string) => void;
  currentProfile?: UserRoleProfile;
}

type DoorFilterTab = 'all' | 'overdue' | 'pending' | 'delivered';
type DoorViewMode = 'table' | 'cards';

export const DoorOrdersView: React.FC<DoorOrdersViewProps> = ({
  doorOrders,
  orders,
  onAddDoorOrder,
  onOpenDoorOrder,
  onEditDoorOrder,
  onDeleteDoorOrder,
  onQuickConfirmDelivery,
  onNavigateToOrder,
  currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canManageDoors = profile.canManageDoors;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<DoorFilterTab>('all');
  const [viewMode, setViewMode] = useState<DoorViewMode>('table');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<DoorOrder | null>(null);
  const [isDoorFilesModalOpen, setIsDoorFilesModalOpen] = useState(false);

  // Obliczenia statystyk KPI
  const stats = useMemo(() => {
    let total = doorOrders.length;
    let overdue = 0;
    let pending = 0;
    let delivered = 0;
    let totalNetto = 0;
    let totalBrutto = 0;
    let overdueNetto = 0;

    doorOrders.forEach((o) => {
      const isDelivered = Boolean(o.terminDostawy && o.terminDostawy.trim() !== '');
      if (isDelivered) {
        delivered++;
      } else {
        const check = checkDoorOrderOverdue(o.terminZamowienia, o.terminDostawy);
        if (check.isOverdue) {
          overdue++;
          if (o.wartoscNetto) overdueNetto += o.wartoscNetto;
        } else {
          pending++;
        }
      }

      if (o.wartoscNetto) totalNetto += o.wartoscNetto;
      if (o.wartoscBrutto) totalBrutto += o.wartoscBrutto;
    });

    return { total, overdue, pending, delivered, totalNetto, totalBrutto, overdueNetto };
  }, [doorOrders]);

  // Filtrowanie i wyszukiwanie
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return doorOrders.filter((order) => {
      // Filtr wg statusu
      const isDelivered = Boolean(order.terminDostawy && order.terminDostawy.trim() !== '');
      const check = checkDoorOrderOverdue(order.terminZamowienia, order.terminDostawy);

      if (filterTab === 'overdue' && !check.isOverdue) return false;
      if (filterTab === 'pending' && (isDelivered || check.isOverdue)) return false;
      if (filterTab === 'delivered' && !isDelivered) return false;

      // Filtr wyszukiwania (dokument, kategoria, ZL, stacje/kontrahent, uwagi)
      if (q) {
        const docMatch = order.numerDokumentu.toLowerCase().includes(q);
        const catMatch = (order.kategoria || '').toLowerCase().includes(q);
        const zlMatch = order.numeryZl.some((zl) => zl.toLowerCase().includes(q));
        const stationsMatch = (order.kontrahentRealizacje || '').toLowerCase().includes(q);
        const notesMatch = (order.uwagi || '').toLowerCase().includes(q);

        if (!docMatch && !catMatch && !zlMatch && !stationsMatch && !notesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [doorOrders, filterTab, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* 1. NAGŁÓWEK MODUŁU DRZWI Z PRZYCISKIEM DODAWANIA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Moduł „Drzwi” — Rejestr Zamówień i Dostaw
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {doorOrders.length} {doorOrders.length === 1 ? 'zamówienie' : 'zamówień'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kompleksowy rejestr zamówień drzwi, kontrola terminów dostaw i bezpośrednie powiązanie ze zleceniami stacji ENCO
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsDoorFilesModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs border border-slate-700 transition-colors cursor-pointer"
            title="Przeglądaj folder i lokalizacje plików technicznych modułu Drzwi"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Pliki i foldery drzwi</span>
          </button>

          {canManageDoors ? (
            <button
              type="button"
              onClick={onAddDoorOrder}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nowe zamówienie drzwi</span>
            </button>
          ) : (
            <div
              title={`Tworzenie i edycja zamówień drzwi dozwolona dla profili: Admin, Dział Handlowy, Logistyka (aktywny: ${profile.name})`}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-300 text-slate-500 text-xs font-semibold rounded-xl select-none cursor-not-allowed"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              <span>Podgląd zamówień drzwi ({profile.shortName})</span>
            </div>
          )}
        </div>
      </div>

      {/* Role permission info banner when in read-only mode */}
      {!canManageDoors && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200 text-amber-950 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Konto „<strong>{profile.name}</strong>” posiada dostęp w trybie <strong>tylko do odczytu</strong> do modułu zamówień drzwi. Pełne uprawnienia do tworzenia, edycji i potwierdzania dostaw posiadają: <strong>Admin</strong>, <strong>Dział Handlowy</strong> oraz <strong>Logistyka</strong>.
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300 shrink-0 self-start sm:self-auto">
            Tylko podgląd
          </span>
        </div>
      )}

      {/* 2. KAFLE KPI / STATYSTYKI Z INTERAKTYWNYM FILTROWANIEM */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Karta 1: Wszystkie */}
        <div
          onClick={() => setFilterTab('all')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={filterTab === 'all' ? 'text-slate-300' : 'text-slate-600'}>
              Wszystkie zamówienia
            </span>
            <FileText className={`w-4 h-4 ${filterTab === 'all' ? 'text-slate-300' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">{stats.total}</div>
          <div className={`mt-1.5 text-[11px] font-medium ${filterTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
            Wartość: <span className="font-bold">{formatPLN(stats.totalNetto)}</span> netto
          </div>
        </div>

        {/* Karta 2: Po terminie */}
        <div
          onClick={() => setFilterTab(filterTab === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterTab === 'overdue'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20'
              : stats.overdue > 0
              ? 'bg-rose-50/80 border-rose-300 hover:border-rose-400 hover:shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={filterTab === 'overdue' ? 'text-rose-100' : 'text-rose-700'}>
              Po terminie z zamówienia
            </span>
            <AlertTriangle className={`w-4 h-4 ${filterTab === 'overdue' ? 'text-rose-200' : 'text-rose-600'}`} />
          </div>
          <div className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${filterTab === 'overdue' ? 'text-white' : 'text-rose-700'}`}>
            {stats.overdue}
          </div>
          <div className={`mt-1.5 text-[11px] font-semibold ${filterTab === 'overdue' ? 'text-rose-100' : 'text-rose-700'}`}>
            {stats.overdue > 0 ? `Wymaga pilnej interwencji (${formatPLN(stats.overdueNetto)})` : 'Wszystko w terminie'}
          </div>
        </div>

        {/* Karta 3: W toku / Oczekujące */}
        <div
          onClick={() => setFilterTab(filterTab === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterTab === 'pending'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={filterTab === 'pending' ? 'text-amber-100' : 'text-amber-700'}>
              W toku / Oczekujące
            </span>
            <Clock className={`w-4 h-4 ${filterTab === 'pending' ? 'text-amber-200' : 'text-amber-600'}`} />
          </div>
          <div className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${filterTab === 'pending' ? 'text-white' : 'text-amber-700'}`}>
            {stats.pending}
          </div>
          <div className={`mt-1.5 text-[11px] font-medium ${filterTab === 'pending' ? 'text-amber-100' : 'text-slate-500'}`}>
            Przed planowanym upływem terminu
          </div>
        </div>

        {/* Karta 4: Dostarczone / Potwierdzone */}
        <div
          onClick={() => setFilterTab(filterTab === 'delivered' ? 'all' : 'delivered')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            filterTab === 'delivered'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={filterTab === 'delivered' ? 'text-emerald-100' : 'text-emerald-700'}>
              Dostarczone / Potwierdzone
            </span>
            <CheckCircle2 className={`w-4 h-4 ${filterTab === 'delivered' ? 'text-emerald-200' : 'text-emerald-600'}`} />
          </div>
          <div className={`mt-2 text-2xl sm:text-3xl font-black tracking-tight ${filterTab === 'delivered' ? 'text-white' : 'text-emerald-700'}`}>
            {stats.delivered}
          </div>
          <div className={`mt-1.5 text-[11px] font-semibold ${filterTab === 'delivered' ? 'text-emerald-100' : 'text-emerald-700'}`}>
            Dostarczone na magazyn / budowę
          </div>
        </div>
      </div>

      {/* 3. PASEK WYSZUKIWANIA I PRZEŁĄCZNIK WIDOKU */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Pole wyszukiwania */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po numerze dokumentu (PZD/...), ZL, stacji, kontrahencie lub uwagach..."
            className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600 px-1 py-0.5 rounded cursor-pointer"
            >
              ✕ Wyczyść
            </button>
          )}
        </div>

        {/* Zakładki filtrów i widoków */}
        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
          {/* Zakładki szybkiego filtru */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Wszystkie ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('overdue')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-2xs font-bold'
                  : stats.overdue > 0
                  ? 'text-rose-700 bg-rose-50 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Po terminie</span>
              {stats.overdue > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filterTab === 'overdue' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-800'}`}>
                  {stats.overdue}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'pending'
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Oczekujące ({stats.pending})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('delivered')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterTab === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dostarczone ({stats.delivered})
            </button>
          </div>

          {/* Przełącznik Tabela / Karty */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Widok tabelaryczny – pełna widoczność wszystkich kolumn bez przewijania"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Widok kafelkowy"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Karty</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. WIDOK 1: NOWOCZESNA TABELA — 100% WIDOCZNYCH ELEMENTÓW BEZ UCIĘĆ I PRZEWIJANIA */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="p-16 text-center text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-700 text-base">Brak zamówień drzwi spełniających wybrane kryteria</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Zmień frazę wyszukiwania, wyzeruj filtry lub kliknij przycisk „Nowe zamówienie drzwi”.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-[220px]">Dokument i Wartość</th>
                    <th className="py-3.5 px-4 w-[230px]">Terminy i Status Dostawy</th>
                    <th className="py-3.5 px-3.5 w-[160px]">Powiązane Zlecenia (ZL)</th>
                    <th className="py-3.5 px-4 min-w-[280px]">Kontrahent / Realizacje & Uwagi</th>
                    <th className="py-3.5 px-4 text-right w-[170px]">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOrders.map((doorOrd) => {
                    const isExpanded = expandedRowId === doorOrd.id;
                    const isDelivered = Boolean(doorOrd.terminDostawy && doorOrd.terminDostawy.trim() !== '');
                    const overdueInfo = checkDoorOrderOverdue(doorOrd.terminZamowienia, doorOrd.terminDostawy);

                    return (
                      <React.Fragment key={doorOrd.id}>
                        <tr
                          className={`hover:bg-slate-50/90 transition-colors group ${
                            isExpanded ? 'bg-blue-50/30' : ''
                          } ${overdueInfo.isOverdue ? 'bg-rose-50/20' : ''}`}
                        >
                          {/* 1. DOKUMENT, KATEGORIA I FINANSE (W PEŁNI WIDOCZNE) */}
                          <td className="py-4 px-4 align-top">
                            <div className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleExpand(doorOrd.id)}
                                className="text-left font-mono text-sm font-black text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1.5 cursor-pointer w-fit"
                              >
                                <span>{doorOrd.numerDokumentu}</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0" />
                                )}
                              </button>

                              {doorOrd.kategoria && (
                                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md border border-slate-200/80 font-mono text-[10px] font-semibold w-fit">
                                  {doorOrd.kategoria}
                                </span>
                              )}

                              {/* Wartości finansowe widoczne od razu */}
                              {(doorOrd.wartoscNetto || doorOrd.wartoscBrutto) ? (
                                <div className="mt-1 pt-1 border-t border-slate-100 font-mono text-[11px] space-y-0.5">
                                  {doorOrd.wartoscNetto && (
                                    <div className="text-slate-600">
                                      Netto: <strong className="text-slate-900">{formatPLN(doorOrd.wartoscNetto)}</strong>
                                    </div>
                                  )}
                                  {doorOrd.wartoscBrutto && (
                                    <div className="text-emerald-700 font-bold">
                                      Brutto: {formatPLN(doorOrd.wartoscBrutto)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Brak kwoty z dok.</span>
                              )}
                            </div>
                          </td>

                          {/* 2. TERMINY I STATUS DOSTAWY (W PEŁNI WIDOCZNE) */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-2">
                              {/* Data zamówienia i termin wymagany */}
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70 space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">Data zamówienia:</span>
                                  <span className="font-mono font-semibold text-slate-800">
                                    {formatDatePL(doorOrd.dataZamowienia)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">Termin wymagany:</span>
                                  <span className={`font-mono font-bold ${overdueInfo.isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>
                                    {formatDatePL(doorOrd.terminZamowienia)}
                                  </span>
                                </div>
                              </div>

                              {/* Status terminowości (Badge) */}
                              <div>
                                {overdueInfo.isOverdue ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>{overdueInfo.label}</span>
                                  </span>
                                ) : isDelivered ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Dostarczono ({formatDatePL(doorOrd.terminDostawy)})</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>W toku ({overdueInfo.label})</span>
                                  </span>
                                )}
                              </div>

                              {/* Szybkie potwierdzenie jeśli nie dostarczono */}
                              {!isDelivered && (
                                <button
                                  type="button"
                                  onClick={() => onQuickConfirmDelivery(doorOrd)}
                                  className="w-full mt-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] font-bold rounded-lg shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                                  title="Potwierdź odbiór drzwi dzisiaj"
                                >
                                  <CheckSquare className="w-3.5 h-3.5" />
                                  <span>Potwierdź dostawę</span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 3. POWIĄZANE ZLECENIA Z BEZPOŚREDNIMI LINKAMI */}
                          <td className="py-4 px-3.5 align-top">
                            <div className="flex flex-col gap-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-400">
                                Numery ZL ({doorOrd.numeryZl.length}):
                              </span>
                              {doorOrd.numeryZl.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {doorOrd.numeryZl.map((zl) => {
                                    const matchingOrder = orders.find(
                                      (o) => isSameOrderNumber(o.orderNumber, zl)
                                    );

                                    return (
                                      <button
                                        key={zl}
                                        type="button"
                                        onClick={() =>
                                          matchingOrder && onNavigateToOrder && onNavigateToOrder(matchingOrder.id)
                                        }
                                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition-all ${
                                          matchingOrder
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white cursor-pointer shadow-2xs'
                                            : 'bg-slate-100 text-slate-700 border border-slate-200 cursor-default'
                                        }`}
                                        title={
                                          matchingOrder
                                            ? `Kliknij, aby otworzyć zlecenie ${matchingOrder.projectName} (${matchingOrder.orderNumber})`
                                            : `Brak aktywnego zlecenia o numerze ${zl}`
                                        }
                                      >
                                        <Tag className="w-3 h-3 opacity-70" />
                                        <span>{zl}</span>
                                        {matchingOrder && (
                                          <ExternalLink className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Brak przypisania ZL</span>
                              )}
                            </div>
                          </td>

                          {/* 4. KONTRAHENT / PRZYPISANE STACJE ORAZ PEŁNE UWAGI */}
                          <td className="py-4 px-4 align-top">
                            <div className="space-y-2">
                              {/* Kontrahent i realizacje */}
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                                  Stacje i realizacje:
                                </span>
                                <div className="text-slate-900 font-semibold text-xs leading-relaxed bg-slate-50/70 p-2 rounded-lg border border-slate-200/70">
                                  {doorOrd.kontrahentRealizacje || (
                                    <span className="text-slate-400 italic">Brak podanego kontrahenta</span>
                                  )}
                                </div>
                              </div>

                              {/* Uwagi – w pełni wyeksponowane, bez obcinania! */}
                              {doorOrd.uwagi ? (
                                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200/80 text-xs text-slate-800">
                                  <div className="flex items-center gap-1 text-[10px] uppercase font-extrabold text-amber-900 mb-1">
                                    <Info className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>Uwagi i specyfikacja techniczna:</span>
                                  </div>
                                  <div className="whitespace-pre-wrap leading-relaxed text-slate-800">
                                    {doorOrd.uwagi}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic block">
                                  Brak dodatkowych uwag technicznych
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 5. PRZYCISKI AKCJI (ZAWSZE WIDOCZNE) */}
                          <td className="py-4 px-4 text-right align-top">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleExpand(doorOrd.id)}
                                className={`w-full max-w-[130px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1 ${
                                  isExpanded
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                <span>{isExpanded ? 'Zwiń' : 'Szczegóły'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {onOpenDoorOrder && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDoorOrder(doorOrd)}
                                  className="w-full max-w-[130px] px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                                >
                                  Otwórz podstronę
                                </button>
                              )}

                              {canManageDoors && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onEditDoorOrder(doorOrd)}
                                    className="w-full max-w-[130px] px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Edytuj</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setOrderToDelete(doorOrd)}
                                    className="w-full max-w-[130px] px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-center gap-1"
                                    title="Usuń zamówienie drzwi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Usuń</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* ROZWINIĘTY WIERSZ: PEŁNE DETALE, HISTORIA ZMIAN I POWIĄZANIA */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-slate-200">
                            <td colSpan={5} className="p-4 sm:p-5">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                                {/* Górna belka szczegółów: Finanse, Dostawa i Przejście do zlecenia */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
                                  {/* Finanse dokumentu */}
                                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                                    <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5 mb-2">
                                      <DollarSign className="w-4 h-4 text-emerald-600" />
                                      Wartość zamówienia źródłowego
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Netto:</span>
                                        <span className="text-base font-mono font-black text-slate-900">
                                          {formatPLN(doorOrd.wartoscNetto)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-[10px] uppercase font-bold text-slate-500 block">Brutto:</span>
                                        <span className="text-base font-mono font-black text-emerald-900">
                                          {formatPLN(doorOrd.wartoscBrutto)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Status realizacji dostawy */}
                                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                                      <Calendar className="w-4 h-4 text-blue-600" />
                                      Potwierdzenie dostawy
                                    </div>
                                    <div className="text-xs">
                                      {doorOrd.terminDostawy ? (
                                        <div className="text-emerald-700 font-bold flex items-center gap-1.5">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                          <span>Dostarczono: {formatDatePL(doorOrd.terminDostawy)}</span>
                                        </div>
                                      ) : (
                                        <div className="text-amber-700 font-bold flex items-center gap-1.5">
                                          <Clock className="w-4 h-4 text-amber-600" />
                                          <span>Oczekuje na dostarczenie</span>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center gap-2">
                                      {canManageDoors ? (
                                        !doorOrd.terminDostawy ? (
                                          <button
                                            type="button"
                                            onClick={() => onQuickConfirmDelivery(doorOrd)}
                                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                                          >
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            <span>Potwierdź dzisiaj</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => onEditDoorOrder(doorOrd)}
                                            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                                          >
                                            Zmień datę dostawy
                                          </button>
                                        )
                                      ) : (
                                        <span className="text-[11px] text-slate-400 italic">
                                          Brak uprawnień do edycji dostawy
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Przejście do zleceń stacji */}
                                  <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/70">
                                    <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5 mb-2">
                                      <Building2 className="w-4 h-4 text-blue-600" />
                                      Powiązane zlecenia stacji ENCO
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {doorOrd.numeryZl.map((zl) => {
                                        const matchingOrder = orders.find(
                                          (o) => isSameOrderNumber(o.orderNumber, zl)
                                        );
                                        return matchingOrder ? (
                                          <button
                                            key={zl}
                                            type="button"
                                            onClick={() => onNavigateToOrder && onNavigateToOrder(matchingOrder.id)}
                                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                                          >
                                            <span>Otwórz {matchingOrder.projectName} ({zl})</span>
                                            <ArrowRight className="w-3.5 h-3.5" />
                                          </button>
                                        ) : (
                                          <span key={zl} className="text-xs text-slate-500 font-mono">
                                            {zl} (brak zlecenia)
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* Rejestr historii zmian terminów i uwag */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                      <Clock className="w-4 h-4 text-blue-600" />
                                      Historia i audit log zmian tego zamówienia
                                    </h4>
                                    <span className="text-[11px] text-slate-400">
                                      Liczba wpisów: {doorOrd.history?.length || 0}
                                    </span>
                                  </div>

                                  {doorOrd.history && doorOrd.history.length > 0 ? (
                                    <div className="space-y-2 border-l-2 border-blue-200 ml-2 pl-3 py-1">
                                      {doorOrd.history.map((h) => {
                                        const dateObj = new Date(h.timestamp);
                                        const formattedTs = isNaN(dateObj.getTime())
                                          ? h.timestamp
                                          : `${dateObj.toLocaleDateString('pl-PL')} ${dateObj.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;

                                        return (
                                          <div key={h.id} className="text-xs text-slate-700 relative">
                                            <div className="absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white" />
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-slate-900">{h.fieldName}</span>
                                              <span className="text-[10px] text-slate-400 font-mono">{formattedTs}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-600 mt-0.5">
                                              <span className="line-through text-slate-400">{h.oldValue}</span>
                                              <span className="mx-1.5 text-slate-400 font-bold">→</span>
                                              <span className="font-bold text-slate-900">{h.newValue}</span>
                                            </div>
                                            {h.note && (
                                              <div className="text-[11px] text-slate-500 italic mt-0.5">
                                                Notatka: {h.note}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-400 italic">
                                      Brak zarejestrowanych zmian terminów lub uwag dla tego zamówienia.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Podsumowanie dolne */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
            <div>
              Wyświetlono <span className="font-bold text-slate-800">{filteredOrders.length}</span> z{' '}
              <span className="font-bold text-slate-800">{doorOrders.length}</span> zamówień drzwi
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span>
                Suma netto: <strong className="text-slate-900">{formatPLN(stats.totalNetto)}</strong>
              </span>
              <span>
                Suma brutto: <strong className="text-emerald-800">{formatPLN(stats.totalBrutto)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. WIDOK 2: KARTY (KAFLE) — DLA PRZEJRZYSTEGO WIDOKU KAŻDEGO ZAMÓWIENIA */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-400">
              <Layers className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="font-bold text-slate-700 text-base">Brak zamówień drzwi spełniających kryteria</p>
              <p className="text-xs text-slate-400 mt-1">Zmień filtry lub dodaj nowe zamówienie.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrders.map((doorOrd) => {
                const isDelivered = Boolean(doorOrd.terminDostawy && doorOrd.terminDostawy.trim() !== '');
                const overdueInfo = checkDoorOrderOverdue(doorOrd.terminZamowienia, doorOrd.terminDostawy);
                const isExpanded = expandedRowId === doorOrd.id;

                return (
                  <div
                    key={doorOrd.id}
                    className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                      overdueInfo.isOverdue
                        ? 'border-rose-300 border-l-4 border-l-rose-600 ring-1 ring-rose-200'
                        : isDelivered
                        ? 'border-emerald-300 border-l-4 border-l-emerald-600'
                        : 'border-slate-200 border-l-4 border-l-amber-500'
                    }`}
                  >
                    {/* Nagłówek karty */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-black text-slate-900 tracking-tight">
                            {doorOrd.numerDokumentu}
                          </span>
                          {doorOrd.kategoria && (
                            <span className="px-2 py-0.5 bg-slate-200/80 text-slate-700 rounded text-[10px] font-mono font-semibold">
                              {doorOrd.kategoria}
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="mt-1.5">
                          {overdueInfo.isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              {overdueInfo.label}
                            </span>
                          ) : isDelivered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Dostarczono ({formatDatePL(doorOrd.terminDostawy)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              W toku ({overdueInfo.label})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Akcje nagłówka */}
                      <div className="flex items-center gap-1">
                        {onOpenDoorOrder && <button type="button" onClick={() => onOpenDoorOrder(doorOrd)} className="rounded-lg p-1.5 text-blue-700 hover:bg-blue-50" title="Otwórz osobną podstronę"><FileText className="h-4 w-4" /></button>}
                        {canManageDoors ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditDoorOrder(doorOrd)}
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                              title="Edytuj zamówienie drzwi"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOrderToDelete(doorOrd)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                              title="Usuń zamówienie drzwi"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                            Podgląd
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ciało karty – wszystkie elementy w pełni widoczne */}
                    <div className="p-4 space-y-3.5 flex-1 text-xs">
                      {/* Terminy */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">Data zamówienia:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatDatePL(doorOrd.dataZamowienia)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">Termin z zamówienia:</span>
                          <span className={`font-mono font-bold ${overdueInfo.isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>
                            {formatDatePL(doorOrd.terminZamowienia)}
                          </span>
                        </div>
                        <div className="col-span-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-medium">Rzeczywista dostawa:</span>
                          <span className={`font-mono font-bold ${isDelivered ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {doorOrd.terminDostawy ? formatDatePL(doorOrd.terminDostawy) : 'Nieustalony'}
                          </span>
                        </div>
                      </div>

                      {/* Finanse */}
                      {(doorOrd.wartoscNetto || doorOrd.wartoscBrutto) && (
                        <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs">
                          <span className="text-emerald-950 font-bold flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                            Wartość:
                          </span>
                          <div className="flex items-center gap-3 font-mono font-bold">
                            {doorOrd.wartoscNetto && (
                              <span className="text-slate-800">Netto: {formatPLN(doorOrd.wartoscNetto)}</span>
                            )}
                            {doorOrd.wartoscBrutto && (
                              <span className="text-emerald-900">Brutto: {formatPLN(doorOrd.wartoscBrutto)}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Kontrahent i stacje */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Kontrahent / Przypisane realizacje:
                        </span>
                        <div className="text-slate-900 font-semibold bg-white p-2.5 rounded-xl border border-slate-200 leading-relaxed">
                          {doorOrd.kontrahentRealizacje || <span className="text-slate-400 italic">Brak wpisu</span>}
                        </div>
                      </div>

                      {/* Powiązane zlecenia ZL */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                          Numery ZL:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {doorOrd.numeryZl.length > 0 ? (
                            doorOrd.numeryZl.map((zl) => {
                              const matchingOrder = orders.find(
                                (o) => isSameOrderNumber(o.orderNumber, zl)
                              );
                              return (
                                <button
                                  key={zl}
                                  type="button"
                                  onClick={() =>
                                    matchingOrder && onNavigateToOrder && onNavigateToOrder(matchingOrder.id)
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
                                    matchingOrder
                                      ? 'bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-600 hover:text-white cursor-pointer shadow-2xs'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200 cursor-default'
                                  }`}
                                  title={matchingOrder ? `Otwórz zlecenie ${matchingOrder.projectName}` : undefined}
                                >
                                  <Tag className="w-3 h-3 opacity-70" />
                                  <span>{zl}</span>
                                  {matchingOrder && <ExternalLink className="w-3 h-3 opacity-70 ml-0.5" />}
                                </button>
                              );
                            })
                          ) : (
                            <span className="text-slate-400 italic text-xs">Brak przypisanych ZL</span>
                          )}
                        </div>
                      </div>

                      {/* Uwagi */}
                      {doorOrd.uwagi && (
                        <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/80">
                          <span className="text-[10px] uppercase font-bold text-amber-900 block mb-1">
                            Uwagi i specyfikacja:
                          </span>
                          <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {doorOrd.uwagi}
                          </div>
                        </div>
                      )}

                      {/* Rozwijana historia */}
                      {isExpanded && doorOrd.history && doorOrd.history.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 space-y-2">
                          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            Historia modyfikacji ({doorOrd.history.length}):
                          </div>
                          <div className="space-y-1.5 border-l-2 border-blue-200 pl-3 py-1">
                            {doorOrd.history.map((h) => (
                              <div key={h.id} className="text-[11px]">
                                <span className="font-semibold text-slate-900">{h.fieldName}: </span>
                                <span className="line-through text-slate-400">{h.oldValue}</span>
                                <span className="mx-1 text-slate-400">→</span>
                                <span className="font-semibold text-slate-800">{h.newValue}</span>
                                {h.note && <span className="text-slate-500 italic ml-1.5">({h.note})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stopka karty */}
                    <div className="p-3.5 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(doorOrd.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                      >
                        {isExpanded ? 'Zwiń historię ↑' : `Historia (${doorOrd.history?.length || 0}) ↓`}
                      </button>

                      <div className="flex items-center gap-2">
                        {canManageDoors ? (
                          <>
                            {!doorOrd.terminDostawy ? (
                              <button
                                type="button"
                                onClick={() => onQuickConfirmDelivery(doorOrd)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Potwierdź dostawę</span>
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-700 font-bold">
                                ✓ Potwierdzono
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => onEditDoorOrder(doorOrd)}
                              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                            >
                              Edytuj
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Tylko podgląd
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. MODAL POTWIERDZENIA USUNIĘCIA ZAMÓWIENIA DRZWI */}
      {orderToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setOrderToDelete(null)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900">
                    Usunąć zamówienie drzwi?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ta operacja jest nieodwracalna. Zamówienie zostanie trwale usunięte z rejestru.
                  </p>
                </div>
              </div>

              {/* Szczegóły dokumentu */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Numer dokumentu:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {orderToDelete.numerDokumentu}
                  </span>
                </div>
                {orderToDelete.kontrahentRealizacje && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 font-medium shrink-0">Realizacje / stacja:</span>
                    <span className="font-semibold text-slate-800 text-right truncate max-w-[220px]">
                      {orderToDelete.kontrahentRealizacje}
                    </span>
                  </div>
                )}
                {orderToDelete.numeryZl.length > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Powiązane ZL:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {orderToDelete.numeryZl.join(', ')}
                    </span>
                  </div>
                )}
                {(orderToDelete.wartoscNetto || orderToDelete.wartoscBrutto) && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-mono text-[11px]">
                    <span className="text-slate-500">Wartość:</span>
                    <span className="font-bold text-slate-900">
                      {orderToDelete.wartoscNetto ? formatPLN(orderToDelete.wartoscNetto) : ''}
                      {orderToDelete.wartoscBrutto ? ` (${formatPLN(orderToDelete.wartoscBrutto)} brutto)` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Przyciski */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const idToDelete = orderToDelete.id;
                    setOrderToDelete(null);
                    onDeleteDoorOrder(idToDelete);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Tak, usuń zamówienie</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Door Module Files Modal */}
      <OrderFilesModal
        isOpen={isDoorFilesModalOpen}
        onClose={() => setIsDoorFilesModalOpen(false)}
        orderNumber="MODUL_DRZWI"
        projectName="Rejestr i rysunki techniczne modułu Drzwi"
        currentProfile={profile}
        initialFolderKey="01_Rysunki_Wykonawcze"
      />
    </div>
  );
};
