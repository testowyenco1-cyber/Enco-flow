import React, { useState, useMemo, useEffect } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Lock,
  FolderOpen,
  Download,
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
  onSaveDoorOrderDirect?: (order: DoorOrder) => void;
  onSaveDoorOrdersBulk?: (orders: DoorOrder[]) => void;
  onDeleteDoorOrder: (id: string) => void;
  onQuickConfirmDelivery: (order: DoorOrder) => void;
  onNavigateToOrder?: (orderId: string) => void;
  currentProfile?: UserRoleProfile;
}

type DoorFilterTab = 'all' | 'overdue' | 'pending' | 'delivered';
type DoorViewMode = 'table' | 'cards';
type DoorSortMode = 'deliveryStatus' | 'deliveryDate' | 'orderDate' | 'document';

export const DoorOrdersView: React.FC<DoorOrdersViewProps> = ({
  doorOrders,
  orders,
  onAddDoorOrder,
  onOpenDoorOrder,
  onEditDoorOrder,
  onSaveDoorOrderDirect,
  onSaveDoorOrdersBulk,
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
  const [sortMode, setSortMode] = useState<DoorSortMode>('deliveryStatus');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const handleSort = (mode: DoorSortMode) => {
    if (sortMode === mode) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortMode(mode); setSortDirection('asc'); }
  }
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<DoorOrder | null>(null);
  const [isDoorFilesModalOpen, setIsDoorFilesModalOpen] = useState(false);
  const [draftsById, setDraftsById] = useState<Record<string, DoorOrder>>({});
  const [dirtyDoorOrderIds, setDirtyDoorOrderIds] = useState<string[]>([]);
  const [zlSearchQuery, setZlSearchQuery] = useState('');
  const [zlDropdownPosition, setZlDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [showExtraTools, setShowExtraTools] = useState(false);

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

    const filtered = doorOrders.filter((order) => {
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

    const dateValue = (value?: string) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
    };
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortMode === 'deliveryStatus') {
        const rank = (order: DoorOrder) => {
          if (order.terminDostawy?.trim()) return 2;
          return checkDoorOrderOverdue(order.terminZamowienia, order.terminDostawy).isOverdue ? 0 : 1;
        };
        comparison = rank(a) - rank(b);
        if (!comparison) comparison = dateValue(a.terminZamowienia) - dateValue(b.terminZamowienia);
      } else if (sortMode === 'deliveryDate') comparison = dateValue(a.terminDostawy) - dateValue(b.terminDostawy);
      else if (sortMode === 'orderDate') comparison = dateValue(a.dataZamowienia) - dateValue(b.dataZamowienia);
      else comparison = a.numerDokumentu.localeCompare(b.numerDokumentu, 'pl', { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [doorOrders, filterTab, searchQuery, sortMode, sortDirection]);

  useEffect(() => {
    const closeZlDropdownOnOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('[data-zl-dropdown]')) return;
      document.querySelectorAll<HTMLDetailsElement>('details[data-zl-dropdown][open]').forEach((dropdown) => {
        dropdown.open = false;
      });
      setZlDropdownPosition(null);
    };

    document.addEventListener('mousedown', closeZlDropdownOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeZlDropdownOnOutsideClick);
  }, []);

  useEffect(() => {
    setDraftsById((current) => {
      const next = { ...current };
      doorOrders.forEach((order) => { if (!dirtyDoorOrderIds.includes(order.id)) next[order.id] = order; });
      Object.keys(next).forEach((id) => { if (!doorOrders.some((order) => order.id === id) && !dirtyDoorOrderIds.includes(id)) delete next[id]; });
      return next;
    });
  }, [doorOrders, dirtyDoorOrderIds]);

  const patchDoorOrder = (order: DoorOrder, key: keyof DoorOrder, value: any) => {
    setDraftsById((current) => {
      const existing = current[order.id] || order;
      const updated: DoorOrder = { ...existing, [key]: value };
      // Przy zmianie netto automatycznie przelicz brutto według stawki VAT 23%.
      if (key === 'wartoscNetto') {
        updated.wartoscBrutto = value == null || value === ''
          ? null
          : Math.round((Number(value) * 1.23 + Number.EPSILON) * 100) / 100;
      }
      return { ...current, [order.id]: updated };
    });
    setDirtyDoorOrderIds((current) => current.includes(order.id) ? current : [...current, order.id]);
  };

  const formatAmountInput = (value: number | null | undefined) =>
    value == null || !Number.isFinite(Number(value)) ? '' : Number(value).toFixed(2);

  const saveDirtyDoorOrders = () => {
    const changed = dirtyDoorOrderIds.map((id) => draftsById[id]).filter((order): order is DoorOrder => Boolean(order))
      .map((order) => ({ ...order, updatedAt: new Date().toISOString() }));
    if (!changed.length) return;
    if (onSaveDoorOrdersBulk) onSaveDoorOrdersBulk(changed);
    else if (onSaveDoorOrderDirect) changed.forEach((order) => onSaveDoorOrderDirect(order));
    else changed.forEach((order) => onEditDoorOrder(order));
    setDirtyDoorOrderIds([]);
  };

  const toggleExpand = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const exportDoorOrdersToExcel = () => {
    const columns = [
      ['Numer dokumentu', (order: DoorOrder) => order.numerDokumentu],
      ['Data zamówienia', (order: DoorOrder) => order.dataZamowienia || ''],
      ['Termin z zamówienia', (order: DoorOrder) => order.terminZamowienia || ''],
      ['Kategoria', (order: DoorOrder) => order.kategoria || ''],
      ['Netto', (order: DoorOrder) => order.wartoscNetto == null ? '' : Number(order.wartoscNetto).toFixed(2)],
      ['Brutto', (order: DoorOrder) => order.wartoscBrutto == null ? '' : Number(order.wartoscBrutto).toFixed(2)],
      ['Numery ZL', (order: DoorOrder) => (order.numeryZl || []).join(', ')],
      ['Kontrahent / realizacje', (order: DoorOrder) => {
        const linked = (order.numeryZl || []).map((zl) => orders.find((o) => isSameOrderNumber(o.orderNumber, zl))).filter((o): o is Order => Boolean(o));
        return linked.length ? linked.map((o) => `${o.orderNumber} — ${o.client?.trim() || 'kontrahent nieuzupełniony'}`).join(' | ') : (order.kontrahentRealizacje || '').replace(/\n/g, ' | ');
      }],
      ['Termin dostawy', (order: DoorOrder) => order.terminDostawy || ''],
      ['Uwagi', (order: DoorOrder) => order.uwagi || ''],
    ] as const;
    const escapeCell = (value: unknown) => {
      const text = String(value ?? '');
      return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      columns.map(([header]) => escapeCell(header)).join(';'),
      ...filteredOrders.map((order) => {
        const current = draftsById[order.id] || order;
        return columns.map(([, getValue]) => escapeCell(getValue(current))).join(';');
      }),
    ];
    const blob = new Blob(['\uFEFFsep=;\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ENCO_Drzwi_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-6 pb-24">
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
            onClick={exportDoorOrdersToExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Eksportuj widoczne zamówienia drzwi do pliku otwieranego w Excelu"
          >
            <Download className="w-4 h-4" />
            <span>Eksport Excel</span>
          </button>
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
      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Pokaż statystyki, wykresy i dodatkowe filtry
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-3">
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

        </div>
      </details>

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

        {/* Sortowanie, zakładki filtrów i widoków */}
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

      {/* 4. GŁÓWNY REJESTR PZD — zwarta tabela */}
      <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Rejestr zamówień PZD</h2>
            <p className="text-[11px] text-slate-600">Edytuj pola bezpośrednio w tabeli. Przycisk „Zapisz zmiany” miga, gdy są niezapisane poprawki.</p>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs font-semibold text-slate-600">Pozycji: {filteredOrders.length} / {doorOrders.length}</span>{canManageDoors && <button type="button" onClick={saveDirtyDoorOrders} disabled={dirtyDoorOrderIds.length === 0} className={"inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors " + (dirtyDoorOrderIds.length ? "animate-pulse border-amber-500 bg-amber-400 text-slate-950 shadow-md" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400")}><CheckSquare className="h-4 w-4" />{dirtyDoorOrderIds.length ? "Zapisz zmiany (" + dirtyDoorOrderIds.length + ")" : "Zapisano"}</button>}</div>
        </div>
        {filteredOrders.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-800">Brak zamówień spełniających kryteria</p>
            <p className="mt-1 text-xs text-slate-500">Zmień wyszukiwanie lub dodaj nowe zamówienie.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-[11px]">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-bold text-slate-800">
                <tr className="[&>th]:border-b [&>th]:border-r [&>th]:border-slate-300 [&>th]:px-1.5 [&>th]:py-2 [&>th]:whitespace-normal [&>th]:break-words [&>th]:leading-tight">
                  <th className="w-[110px]"><button type="button" onClick={() => handleSort('document')} className="inline-flex items-center gap-1 text-left hover:text-blue-700" title="Sortuj według numeru dokumentu">Numer dokumentu {sortMode === 'document' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-slate-400" />}</button></th>
                  <th className="w-[105px]"><button type="button" onClick={() => handleSort('orderDate')} className="inline-flex items-center gap-1 text-left hover:text-blue-700" title="Sortuj według daty zamówienia">Data zamówienia {sortMode === 'orderDate' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-slate-400" />}</button></th>
                  <th className="w-[105px]">Termin z zamówienia</th>
                  <th className="w-[115px]">Kategoria</th>
                  <th className="w-[85px] text-right">Netto</th>
                  <th className="w-[85px] text-right">Brutto</th>
                  <th className="w-[125px]">Numer ZL</th>
                  <th className="w-[180px]">Kontrahent</th>
                  <th className="w-[155px]"><div className="flex flex-col items-start gap-1"><button type="button" onClick={() => handleSort('deliveryDate')} className="inline-flex items-center gap-1 text-left hover:text-blue-700" title="Sortuj według terminu dostawy">Termin dostawy {sortMode === 'deliveryDate' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-slate-400" />}</button><button type="button" onClick={() => handleSort('deliveryStatus')} className="inline-flex items-center gap-1 text-left hover:text-blue-700" title="Domyślnie: po terminie, oczekujące, dostarczone. Kliknij, aby zmienić kierunek sortowania.">Status dostawy {sortMode === 'deliveryStatus' ? (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-slate-400" />}</button></div></th>
                  <th className="w-[140px]">Uwagi</th>
                  <th className="w-[70px] text-center">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {filteredOrders.map((doorOrd, index) => {
                  const row = draftsById[doorOrd.id] || doorOrd;
                  const overdueInfo = checkDoorOrderOverdue(row.terminZamowienia, row.terminDostawy);
                  const isDelivered = Boolean(row.terminDostawy && row.terminDostawy.trim());
                  const zlSearch = zlSearchQuery.trim().toLowerCase();
                  const filteredZlOrders = orders.filter((availableOrder) =>
                    !zlSearch ||
                    availableOrder.orderNumber.toLowerCase().includes(zlSearch) ||
                    (availableOrder.client || '').toLowerCase().includes(zlSearch) ||
                    (availableOrder.projectName || '').toLowerCase().includes(zlSearch)
                  );
                  const cellInput = "w-full min-w-0 max-w-full rounded border border-blue-300 bg-white px-1 py-1 text-[11px] text-slate-900 outline-none focus:ring-2 focus:ring-blue-200";
                  const patch = (key: keyof DoorOrder, value: any) => patchDoorOrder(doorOrd, key, value);
                  return (
                    <tr
                      key={doorOrd.id}
                      className={`group align-top transition-colors ${isDelivered ? '!bg-blue-100/70 text-blue-950 hover:!bg-blue-100' : index % 2 === 0 ? 'bg-white hover:bg-blue-50/70' : 'bg-slate-50/60 hover:bg-blue-50/70'} ${overdueInfo.isOverdue ? '!bg-rose-100/70 hover:!bg-rose-100' : ''} ${isDelivered ? 'border-l-4 border-l-blue-500' : ''}`}
                    >
                      <td className="border-r border-slate-100 px-2 py-2">
                        {canManageDoors ? <input aria-label="Numer dokumentu" className={cellInput + " font-mono font-bold"} value={row.numerDokumentu} onChange={(e) => patch('numerDokumentu', e.target.value)} /> : <button type="button" onClick={() => onOpenDoorOrder ? onOpenDoorOrder(doorOrd) : toggleExpand(doorOrd.id)} className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline text-left">{doorOrd.numerDokumentu}</button>}
                        {overdueInfo.isOverdue && <div className="mt-1 text-[10px] font-bold text-rose-700">Po terminie</div>}
                        {isDelivered && <div className="mt-1 text-[10px] font-semibold text-emerald-700">Dostarczono</div>}
                      </td>
                      <td className="min-w-0 border-r border-slate-100 px-1.5 py-2 font-mono">{canManageDoors ? <input aria-label="Data zamówienia" type="date" className={cellInput} value={row.dataZamowienia || ''} onChange={(e) => patch('dataZamowienia', e.target.value)} /> : formatDatePL(doorOrd.dataZamowienia)}</td>
                      <td className={`min-w-0 border-r border-slate-100 px-1.5 py-2 font-mono font-semibold ${overdueInfo.isOverdue ? 'text-rose-700' : ''}`}>{canManageDoors ? <input aria-label="Termin z zamówienia" type="date" className={cellInput} value={row.terminZamowienia || ''} onChange={(e) => patch('terminZamowienia', e.target.value)} /> : formatDatePL(doorOrd.terminZamowienia)}</td>
                      <td className="border-r border-slate-100 px-2 py-2 font-mono">{canManageDoors ? <input aria-label="Kategoria" className={cellInput} value={row.kategoria || ''} onChange={(e) => patch('kategoria', e.target.value)} /> : doorOrd.kategoria || '—'}</td>
                      <td className="min-w-0 border-r border-slate-100 px-1.5 py-2 text-right font-mono tabular-nums">{canManageDoors ? <input aria-label="Netto" type="number" step="0.01" className={cellInput + ' text-right'} value={formatAmountInput(row.wartoscNetto)} onChange={(e) => patch('wartoscNetto', e.target.value === '' ? null : Number(e.target.value))} /> : formatPLN(doorOrd.wartoscNetto)}</td>
                      <td className="min-w-0 border-r border-slate-100 px-1.5 py-2 text-right font-mono font-semibold tabular-nums">{canManageDoors ? <input aria-label="Brutto" type="number" step="0.01" className={cellInput + ' text-right'} value={formatAmountInput(row.wartoscBrutto)} onChange={(e) => patch('wartoscBrutto', e.target.value === '' ? null : Number(e.target.value))} /> : formatPLN(doorOrd.wartoscBrutto)}</td>
                      <td className="min-w-0 border-r border-slate-100 px-1.5 py-2 break-words">
                        <div className="flex flex-wrap gap-1">
                          {canManageDoors ? (
                            <details data-zl-dropdown className="relative min-w-0">
                              <summary onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setZlDropdownPosition({ top: rect.bottom + 4, left: rect.left }); }} className="max-w-full cursor-pointer list-none whitespace-normal break-words rounded border border-blue-300 bg-white px-1.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-blue-50">
                                {row.numeryZl.length ? `Wybrano: ${row.numeryZl.length} ZL ▾` : 'Wybierz zlecenia ZL ▾'}
                              </summary>
                              <div style={{ top: zlDropdownPosition?.top ?? 0, left: zlDropdownPosition?.left ?? 0 }} className="fixed z-50 mt-1 w-80 max-w-[80vw] rounded-lg border border-slate-300 bg-white p-2 shadow-xl">
                                <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Zaznacz powiązane zlecenia</div>
                                <input
                                  type="text"
                                  value={zlSearchQuery}
                                  onChange={(e) => setZlSearchQuery(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  placeholder="Wpisz numer ZL, klienta lub projekt..."
                                  aria-label="Szukaj zlecenia ZL"
                                  className="mb-2 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                                <div className="max-h-52 overflow-y-auto">
                                {filteredZlOrders.length ? filteredZlOrders.map((availableOrder) => {
                                  const checked = row.numeryZl.some((zl) => isSameOrderNumber(zl, availableOrder.orderNumber));
                                  return (
                                    <label key={availableOrder.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-blue-50">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5 accent-blue-600"
                                        checked={checked}
                                        onChange={(e) => {
                                          const unmatched = row.numeryZl.filter((zl) => !orders.some((existing) => isSameOrderNumber(existing.orderNumber, zl)));
                                          const selected = row.numeryZl.filter((zl) => orders.some((existing) => isSameOrderNumber(existing.orderNumber, zl)) && !isSameOrderNumber(availableOrder.orderNumber, zl));
                                          const nextNumbers = e.target.checked ? [...selected, availableOrder.orderNumber, ...unmatched] : [...selected, ...unmatched];
                                          const uniqueNumbers = Array.from(new Set(nextNumbers));
                                          const linked = orders.filter((o) => uniqueNumbers.some((zl) => isSameOrderNumber(o.orderNumber, zl)));
                                          patch('numeryZl', uniqueNumbers);
                                          patch('kontrahentRealizacje', linked.map((o) => `${o.orderNumber} — ${o.client?.trim() || 'kontrahent nieuzupełniony'}`).join('\n'));
                                        }}
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span className="block font-mono text-[11px] font-bold text-blue-800">{availableOrder.orderNumber}</span>
                                        <span className="block break-words text-[11px] text-slate-600">{availableOrder.client || 'Brak kontrahenta'}{availableOrder.projectName ? ` · ${availableOrder.projectName}` : ''}</span>
                                      </span>
                                    </label>
                                  );
                                }) : <p className="px-2 py-2 text-xs text-slate-500">{orders.length ? 'Brak wyników wyszukiwania.' : 'Brak zleceń w aplikacji.'}</p>}
                                </div>
                                {row.numeryZl.some((zl) => !orders.some((o) => isSameOrderNumber(o.orderNumber, zl))) && (
                                  <p className="mt-1 border-t border-slate-200 px-2 pt-2 text-[10px] text-amber-700">Zachowano również wcześniej wpisane numery ZL, których nie ma na liście zleceń.</p>
                                )}
                              </div>
                            </details>
                          ) : doorOrd.numeryZl.length ? doorOrd.numeryZl.map((zl) => {
                            const matchingOrder = orders.find((o) => isSameOrderNumber(o.orderNumber, zl));
                            return <button key={zl} type="button" onClick={() => matchingOrder && onNavigateToOrder?.(matchingOrder.id)} title={matchingOrder ? `Otwórz zlecenie ${matchingOrder.projectName}` : `Brak aktywnego zlecenia ${zl}`} className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${matchingOrder ? 'border-blue-200 bg-blue-50 font-semibold text-blue-800 hover:bg-blue-100' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>{zl}</button>;
                          }) : '—'}
                        </div>
                      </td>
                      <td className="min-w-0 border-r border-slate-100 px-2 py-2 align-top">
                        <div className="space-y-1.5 text-[11px] leading-snug">
                          {(() => {
                            const linkedOrders = row.numeryZl.map((zl) => orders.find((o) => isSameOrderNumber(o.orderNumber, zl))).filter((o): o is Order => Boolean(o));
                            const entries = linkedOrders.length
                              ? linkedOrders.map((o) => `${o.orderNumber} — ${o.client?.trim() || 'kontrahent nieuzupełniony'}`)
                              : (row.kontrahentRealizacje || '').split('\n').map((entry) => entry.trim()).filter(Boolean);
                            return entries.length ? entries.map((entry, entryIndex) => (
                              <div key={`${doorOrd.id}-kontrahent-${entryIndex}`} className="flex min-w-0 items-start gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1">
                                <span className="shrink-0 font-black text-blue-700">•</span>
                                <span className="min-w-0 break-words text-slate-800">{entry}</span>
                              </div>
                            )) : <span className="text-slate-400">—</span>;
                          })()}
                        </div>
                      </td>
                      <td className={`min-w-0 border-r border-slate-100 px-1.5 py-2 font-mono ${isDelivered ? 'text-blue-800 font-semibold' : 'text-slate-600'}`}>
                        <div className="flex min-w-0 flex-col items-start gap-1.5">
                          {canManageDoors ? <input aria-label="Termin dostawy" type="date" className={cellInput} value={row.terminDostawy || ''} onChange={(e) => patch('terminDostawy', e.target.value)} /> : doorOrd.terminDostawy ? formatDatePL(doorOrd.terminDostawy) : '—'}
                          {canManageDoors ? (
                            <button
                              type="button"
                              onClick={() => isDelivered ? patch('terminDostawy', '') : onQuickConfirmDelivery(doorOrd)}
                              title={isDelivered ? "Cofnij potwierdzenie dostawy; następnie kliknij „Zapisz zmiany”" : "Oznacz zamówienie jako dostarczone i potwierdź dostawę"}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold shadow-xs transition-colors ${isDelivered ? 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100' : 'border-blue-200 bg-white text-blue-700 hover:border-blue-400 hover:bg-blue-600 hover:text-white'}`}
                            >
                              {isDelivered ? <><CheckCircle2 className="h-3 w-3" /> Dostarczono — cofnij</> : <><CheckSquare className="h-3 w-3" /> Oznacz jako dostarczone</>}
                            </button>
                          ) : isDelivered ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-100 px-2 py-1 text-[10px] font-bold text-blue-800"><CheckCircle2 className="h-3 w-3" /> Dostawa potwierdzona</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-r border-slate-100 px-2 py-2 leading-snug break-words"><div className="whitespace-pre-wrap break-words">{canManageDoors ? <textarea aria-label="Uwagi" className={cellInput + " resize-none overflow-hidden whitespace-pre-wrap break-words"} rows={2} ref={(element) => { if (element) { element.style.height = 'auto'; element.style.height = `${element.scrollHeight}px`; } }} value={row.uwagi || ''} onChange={(e) => patch('uwagi', e.target.value)} /> : doorOrd.uwagi || '—'}</div></td>
                      <td className="min-w-0 px-1 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!canManageDoors ? <span className="text-[10px] text-slate-500">Podgląd</span> : <>
                            <button type="button" onClick={() => setOrderToDelete(doorOrd)} title="Usuń zamówienie drzwi" className="rounded p-1.5 text-rose-600 hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
