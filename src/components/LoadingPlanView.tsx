import React, { useState, useMemo } from 'react';
import {
  Order,
  OrderItem,
  ItemStatus,
  STATUS_META,
  getDepartureDateUrgency,
  DoorOrder,
  formatDatePL,
} from '../types/enco';
import {
  UserRoleProfile,
  USER_PROFILES,
  canEditItemType,
} from '../types/userRole';
import {
  Search,
  Calendar,
  Truck,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Layers,
  FileText,
  Printer,
  ChevronRight,
  ExternalLink,
  Edit2,
  Lock,
  Download,
  Shield,
  Eye,
} from 'lucide-react';
import { StatusSwitcher } from './StatusSwitcher';

interface LoadingPlanViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
  onUpdateOrderStatus?: (orderId: string, updatedOrder: Order) => void;
  onUpdateOrderField?: (orderId: string, updatedFields: Partial<Order>) => void;
  doorOrders?: DoorOrder[];
  currentProfile?: UserRoleProfile;
  onBackToDashboard?: () => void;
}

type SortField = 'departureDate' | 'orderNumber' | 'client' | 'projectName';
type SortOrder = 'asc' | 'desc';
type FilterTab = 'all' | 'next_14_days' | 'in_progress' | 'ready' | 'problems';

export const LoadingPlanView: React.FC<LoadingPlanViewProps> = ({
  orders,
  onSelectOrder,
  onUpdateOrderStatus,
  onUpdateOrderField,
  doorOrders = [],
  currentProfile,
  onBackToDashboard,
}) => {
  const profile = currentProfile || USER_PROFILES.ogolny;
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortField, setSortField] = useState<SortField>('departureDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Quick edit modal for loading info & wkładki
  const [editingOrder, setEditingOrder] = useState<{
    orderId: string;
    orderNumber: string;
    loadingInfo: string;
    wkladki: string;
  } | null>(null);

  // Helper to extract item by type
  const getItem = (order: Order, type: string): OrderItem | undefined => {
    return order.items.find((it) => it.type === type);
  };

  // Helper to format concise status badge
  const renderStatusPill = (
    item: OrderItem | undefined,
    fallbackText = 'Brak',
    extraText?: string
  ) => {
    if (!item) {
      return (
        <span className="text-[10px] text-slate-400 italic">
          {fallbackText}
        </span>
      );
    }

    const meta = STATUS_META[item.status] || STATUS_META.NOT_ORDERED;

    return (
      <div className="flex flex-col items-start gap-0.5 leading-tight">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta.bgBadge} ${meta.textBadge} ${meta.borderBadge}`}
          title={`${item.name}: ${meta.label}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotColor}`} />
          <span>{meta.shortLabel}</span>
        </span>
        {extraText && (
          <span className="text-[10px] text-slate-600 font-mono line-clamp-1 max-w-[150px]" title={extraText}>
            {extraText}
          </span>
        )}
      </div>
    );
  };

  // Extract wkładki bezpiecznikowe
  const getWkladki = (order: Order): string => {
    const snItem = getItem(order, 'ROZDZIELNICA_SN');
    const nnItem = getItem(order, 'ROZDZIELNICA_NN');

    if (snItem?.details?.wkladki) return snItem.details.wkladki;
    if (nnItem?.details?.wkladki) return nnItem.details.wkladki;
    if (order.generalNotes?.toLowerCase().includes('wkładk')) {
      const match = order.generalNotes.match(/wkładk[a-z]*:?\s*([^\n,]+)/i);
      if (match) return match[1].trim();
    }
    // Domyślne wkładki na podstawie typu rozdzielnicy lub wielkości stacji
    if (order.stationSize.includes('400') || order.stationSize.includes('630')) {
      return '50 A / 6,3 A';
    }
    if (order.stationSize.includes('250')) {
      return '25 A / 4 A';
    }
    return '50 A / 6,3 A';
  };

  // Extract krótka informacja do daty wyjazdu (np. „załadunek 15/10”)
  const getLoadingNote = (order: Order): string => {
    const wyjazdItem = getItem(order, 'DATA_WYJAZDU');
    if (wyjazdItem?.notes && wyjazdItem.notes.trim()) {
      return wyjazdItem.notes.trim();
    }
    if (wyjazdItem?.details?.dataTransportu) {
      return `transport: ${formatDatePL(wyjazdItem.details.dataTransportu)}`;
    }
    if (order.departureDate) {
      const parts = order.departureDate.split('-');
      if (parts.length === 3) {
        return `załadunek ${parts[2]}/${parts[1]}`;
      }
    }
    return 'załadunek wg planu';
  };

  // Extract SN info
  const getSnSummary = (order: Order): { status: ItemStatus; label: string } => {
    const item = getItem(order, 'ROZDZIELNICA_SN');
    if (!item) return { status: 'NOT_ORDERED', label: 'Brak SN' };

    const prod = item.details?.producent || '';
    const model = item.details?.model || item.details?.typRozdzielnicy || '';
    const config = item.details?.konfiguracjaPol || '';

    const labelParts = [
      prod === 'Schneider Electric' ? 'Schneider' : prod,
      model,
      config,
    ].filter(Boolean);

    return {
      status: item.status,
      label: labelParts.length > 0 ? labelParts.join(' ') : 'SN wg proj.',
    };
  };

  // Extract nN info
  const getNnSummary = (order: Order): { status: ItemStatus; label: string } => {
    const item = getItem(order, 'ROZDZIELNICA_NN');
    if (!item) return { status: 'NOT_ORDERED', label: 'Brak nN' };

    const typ = item.details?.typRozdzielnicy || 'RTS-z';
    const pola = item.details?.iloscPol ? `${item.details.iloscPol}p.` : '';
    const label = [typ, pola].filter(Boolean).join(' ');

    return {
      status: item.status,
      label: label || 'nN standard',
    };
  };

  // Extract Szafka Telemechaniki
  const getSzafkaSummary = (order: Order): { status: ItemStatus; label: string } => {
    const item = getItem(order, 'SZAFKA_TELEMECHANIKI');
    if (!item) return { status: 'NOT_ORDERED', label: 'Brak' };

    const typ = item.details?.typ ? item.details.typ.replace('Szafka ', '') : 'RTU GSM';
    return {
      status: item.status,
      label: typ,
    };
  };

  // Extract Most Kablowy SN
  const getMostSummary = (order: Order): { status: ItemStatus; label: string } => {
    const item = getItem(order, 'MOST');
    if (!item) return { status: 'NOT_ORDERED', label: 'Brak' };

    const typ = item.details?.typPrzekroj || item.details?.rodzajKabla || '1x120 Al';
    return {
      status: item.status,
      label: typ,
    };
  };

  // Extract DTR
  const getDtrStatus = (order: Order): ItemStatus => {
    const rysItem = getItem(order, 'RYS_AKCEPTACJA');
    const powykonItem = getItem(order, 'POWYKONAWCZA');
    if (powykonItem?.status === 'READY') return 'READY';
    if (rysItem?.status === 'READY') return 'READY';
    if (rysItem?.status === 'IN_PROGRESS') return 'IN_PROGRESS';
    return 'ORDERED';
  };

  // Filter & Search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesZl = order.orderNumber.toLowerCase().includes(q);
        const matchesClient = order.client.toLowerCase().includes(q);
        const matchesProject = order.projectName.toLowerCase().includes(q);
        const matchesStation = order.stationSize.toLowerCase().includes(q);
        if (!matchesZl && !matchesClient && !matchesProject && !matchesStation) {
          return false;
        }
      }

      // Tab filter
      if (filterTab === 'all') return true;

      const urgency = getDepartureDateUrgency(order.departureDate);
      if (filterTab === 'next_14_days') {
        return urgency.isUrgent || urgency.daysRemaining <= 14;
      }
      if (filterTab === 'in_progress') {
        return order.status === 'IN_PROGRESS';
      }
      if (filterTab === 'ready') {
        return order.status === 'READY';
      }
      if (filterTab === 'problems') {
        return order.status === 'PROBLEM' || order.items.some((i) => i.status === 'PROBLEM');
      }

      return true;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'departureDate') {
        comparison = (a.departureDate || '').localeCompare(b.departureDate || '');
      } else if (sortField === 'orderNumber') {
        comparison = a.orderNumber.localeCompare(b.orderNumber);
      } else if (sortField === 'client') {
        comparison = a.client.localeCompare(b.client);
      } else if (sortField === 'projectName') {
        comparison = a.projectName.localeCompare(b.projectName);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [orders, searchQuery, filterTab, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Banner / Navigation for Mini Loading Plan */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-600/20 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Plan Załadunków
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                Mini Dashboard ({orders.length} stacji)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${profile.badgeBg}`}>
                Profil: {profile.name}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Kompaktowy przegląd operacyjny wyjazdów, weryfikacja aparatury SN/nN, telemechaniki i kompletności dokumentacji stacji ENCO
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0 flex-wrap">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ← Pełny Dashboard
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Wydrukuj skrócony plan załadunków"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Drukuj plan</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar: Search, Filters & Stats */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj po ZL, temacie, kliencie, typie stacji..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filterTab === 'all'
                ? 'bg-slate-900 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Wszystkie ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('next_14_days')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors flex items-center gap-1.5 ${
              filterTab === 'next_14_days'
                ? 'bg-blue-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Najbliższe 14 dni</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('in_progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filterTab === 'in_progress'
                ? 'bg-amber-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            W realizacji
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('ready')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filterTab === 'ready'
                ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Gotowe
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('problems')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
              filterTab === 'problems'
                ? 'bg-rose-600 text-white shadow-2xs font-bold'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            Wymaga uwagi
          </button>
        </div>
      </div>

      {/* Mini Table — 16 columns matching exact specification */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider divide-x divide-slate-700/60 whitespace-nowrap">
                <th className="py-3 px-3 min-w-[130px] sticky left-0 z-20 bg-slate-900 shadow-sm">
                  <div
                    onClick={() => toggleSort('departureDate')}
                    className="flex items-center gap-1 cursor-pointer hover:text-blue-300"
                    title="Kliknij, aby posortować po dacie wyjazdu"
                  >
                    <span>Data wyjazdu</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-2.5 min-w-[90px] sticky left-[130px] z-20 bg-slate-900 shadow-sm">
                  <div
                    onClick={() => toggleSort('orderNumber')}
                    className="flex items-center gap-1 cursor-pointer hover:text-blue-300"
                    title="Kliknij, aby posortować po numerze ZL"
                  >
                    <span>Nr ZL</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[140px]">
                  <div
                    onClick={() => toggleSort('projectName')}
                    className="flex items-center gap-1 cursor-pointer hover:text-blue-300"
                  >
                    <span>Nazwa tematu</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[130px]">
                  <div
                    onClick={() => toggleSort('client')}
                    className="flex items-center gap-1 cursor-pointer hover:text-blue-300"
                  >
                    <span>Klient</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-2.5 min-w-[100px]">Typ stacji</th>
                <th className="py-3 px-2.5 min-w-[110px] bg-slate-800/90 text-amber-200">
                  Wkładki bezpiecz.
                </th>
                <th className="py-3 px-2.5 min-w-[110px]">Dokumentacja</th>
                <th className="py-3 px-2.5 min-w-[90px]">Drzwi</th>
                <th className="py-3 px-3 min-w-[170px] bg-slate-800/90 text-blue-200">
                  SN (typ/konfig.)
                </th>
                <th className="py-3 px-3 min-w-[140px]">nN (rozdzielnica)</th>
                <th className="py-3 px-2.5 min-w-[130px]">Szafka (telemech.)</th>
                <th className="py-3 px-2.5 min-w-[110px]">Montaż Serwispol</th>
                <th className="py-3 px-2.5 min-w-[110px]">Montaż Warszawa</th>
                <th className="py-3 px-2.5 min-w-[130px]">Most kablowy SN</th>
                <th className="py-3 px-2 min-w-[80px]">DTR</th>
                <th className="py-3 px-2.5 min-w-[110px]">Powykonawcza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={16} className="py-12 text-center text-slate-400">
                    Brak zleceń pasujących do wybranego filtru lub wyszukiwanej frazy.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const urgency = getDepartureDateUrgency(order.departureDate);
                  const loadingNote = getLoadingNote(order);
                  const wkladki = getWkladki(order);
                  const snSummary = getSnSummary(order);
                  const nnSummary = getNnSummary(order);
                  const szafkaSummary = getSzafkaSummary(order);
                  const mostSummary = getMostSummary(order);
                  const dtrStatus = getDtrStatus(order);

                  const dokItem = getItem(order, 'RYS_AKCEPTACJA');
                  const drzwiItem = getItem(order, 'DRZWI');
                  const serwispolItem = getItem(order, 'ZAM_SERWISPOL') || getItem(order, 'ZAP_SERWISPOL');
                  const montazWwaItem = getItem(order, 'ZLECENIE_MONTAZU') || getItem(order, 'ZAM_JK');
                  const powykonItem = getItem(order, 'POWYKONAWCZA');

                  // Highlight if urgent
                  const isUrgent = urgency.isUrgent;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order.id)}
                      className={`hover:bg-blue-50/60 transition-colors cursor-pointer group divide-x divide-slate-100 ${
                        isUrgent ? 'bg-rose-50/30' : ''
                      }`}
                      title="Kliknij, aby otworzyć pełne szczegóły zlecenia"
                    >
                      {/* 1. Data wyjazdu / gotowości + opcjonalna krótka informacja (np. załadunek 15/10) */}
                      <td className="py-2.5 px-3 sticky left-0 z-10 bg-white group-hover:bg-blue-50/90 shadow-xs">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                            {formatDatePL(order.departureDate)}
                            {isUrgent && (
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
                            )}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-semibold mt-0.5 line-clamp-1">
                            {loadingNote}
                          </span>
                        </div>
                      </td>

                      {/* 2. Nr ZL */}
                      <td className="py-2.5 px-2.5 sticky left-[130px] z-10 bg-white group-hover:bg-blue-50/90 shadow-xs">
                        <span className="font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block">
                          {order.orderNumber}
                        </span>
                      </td>

                      {/* 3. Nazwa tematu */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-slate-800 line-clamp-1" title={order.projectName}>
                          {order.projectName}
                        </span>
                      </td>

                      {/* 4. Klient */}
                      <td className="py-2.5 px-3">
                        <span className="text-slate-600 line-clamp-1" title={order.client}>
                          {order.client}
                        </span>
                      </td>

                      {/* 5. Typ stacji */}
                      <td className="py-2.5 px-2.5">
                        <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap">
                          {order.stationSize}
                        </span>
                      </td>

                      {/* 6. Wkładki bezpiecznikowe */}
                      <td className="py-2.5 px-2.5 bg-amber-50/40 font-mono text-[11px] font-bold text-amber-900 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 bg-amber-100/80 rounded border border-amber-300">
                          {wkladki}
                        </span>
                      </td>

                      {/* 7. Dokumentacja */}
                      <td className="py-2.5 px-2.5">
                        {renderStatusPill(dokItem, 'Rysunki')}
                      </td>

                      {/* 8. Drzwi */}
                      <td className="py-2.5 px-2.5">
                        {renderStatusPill(drzwiItem, 'Drzwi')}
                      </td>

                      {/* 9. SN */}
                      <td className="py-2.5 px-3 bg-blue-50/20">
                        <div className="flex flex-col items-start gap-0.5">
                          {renderStatusPill(getItem(order, 'ROZDZIELNICA_SN'), 'SN', snSummary.label)}
                        </div>
                      </td>

                      {/* 10. nN */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col items-start gap-0.5">
                          {renderStatusPill(getItem(order, 'ROZDZIELNICA_NN'), 'nN', nnSummary.label)}
                        </div>
                      </td>

                      {/* 11. Szafka */}
                      <td className="py-2.5 px-2.5">
                        <div className="flex flex-col items-start gap-0.5">
                          {renderStatusPill(getItem(order, 'SZAFKA_TELEMECHANIKI'), 'Telemech.', szafkaSummary.label)}
                        </div>
                      </td>

                      {/* 12. Montaż Serwispol */}
                      <td className="py-2.5 px-2.5">
                        {renderStatusPill(serwispolItem, 'Serwispol')}
                      </td>

                      {/* 13. Montaż Warszawa */}
                      <td className="py-2.5 px-2.5">
                        {renderStatusPill(montazWwaItem, 'Wwa / hala')}
                      </td>

                      {/* 14. Most kablowy SN */}
                      <td className="py-2.5 px-2.5">
                        <div className="flex flex-col items-start gap-0.5">
                          {renderStatusPill(getItem(order, 'MOST'), 'Most SN', mostSummary.label)}
                        </div>
                      </td>

                      {/* 15. DTR */}
                      <td className="py-2.5 px-2">
                        {renderStatusPill(
                          {
                            ...({} as OrderItem),
                            name: 'DTR',
                            status: dtrStatus,
                          },
                          'DTR'
                        )}
                      </td>

                      {/* 16. Dokumentacja powykonawcza */}
                      <td className="py-2.5 px-2.5">
                        {renderStatusPill(powykonItem, 'Powykonawcza')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with legend */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold text-slate-700">Legenda statusów w Planie Załadunków:</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Gotowe / Zatwierdzone
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> W realizacji
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Zlecone / Zamówione
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Wymaga uwagi
            </span>
          </div>

          <div className="text-slate-600 font-mono">
            Wyświetlono: <strong>{filteredOrders.length}</strong> z <strong>{orders.length}</strong> zleceń
          </div>
        </div>
      </div>
    </div>
  );
};
