import React, { useState, useMemo } from 'react';
import {
  Order,
  OrderStatus,
  ItemStatus,
  STATUS_META,
  getDepartureDateUrgency,
  DoorOrder,
  checkDoorOrderOverdue,
} from '../types/enco';
import { OrderStatusBadge } from './StatusBadge';
import { DepartureBadge } from './DepartureBadge';
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Plus,
  Building2,
  Box,
  Layers,
  Shield,
  Lock,
  Truck,
} from 'lucide-react';
import { UserRoleProfile, USER_PROFILES, canEditItemType } from '../types/userRole';

interface DashboardViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
  onNewOrder: () => void;
  filterTab: string;
  onFilterTabChange: (tab: string) => void;
  doorOrders?: DoorOrder[];
  onOpenDoorModule?: () => void;
  onOpenLoadingPlan?: () => void;
  currentProfile?: UserRoleProfile;
}

type SortField = 'departureDate' | 'orderNumber' | 'client' | 'projectName' | 'status';
type SortOrder = 'asc' | 'desc';

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  onSelectOrder,
  onNewOrder,
  filterTab,
  onFilterTabChange,
  doorOrders,
  onOpenDoorModule,
  onOpenLoadingPlan,
  currentProfile,
}) => {
const profile = currentProfile || USER_PROFILES.admin;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('departureDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  // KPI Calculations
  const stats = useMemo(() => {
    let total = orders.length;
    let inProgress = 0;
    let ready = 0;
    let problems = 0;
    let urgentDeparture = 0;

    orders.forEach((ord) => {
      if (ord.status === 'PROBLEM') problems++;
      else if (ord.status === 'READY') ready++;
      else if (ord.status === 'IN_PROGRESS') inProgress++;

      const urgency = getDepartureDateUrgency(ord.departureDate, ord.status === 'READY');
      if (ord.status !== 'READY' && (urgency.status === 'overdue' || urgency.status === 'urgent')) {
        urgentDeparture++;
      }
    });

    return { total, inProgress, ready, problems, urgentDeparture };
  }, [orders]);

  // Filtering
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.client.toLowerCase().includes(q) ||
          o.projectName.toLowerCase().includes(q) ||
          o.stationSize.toLowerCase().includes(q)
      );
    }

    // Filter tab
    if (filterTab === 'problem') {
      result = result.filter((o) => o.status === 'PROBLEM');
    } else if (filterTab === 'urgent') {
      result = result.filter((o) => {
        if (o.status === 'PROBLEM') return true;
        const urgency = getDepartureDateUrgency(o.departureDate, o.status === 'READY');
        return o.status !== 'READY' && (urgency.status === 'overdue' || urgency.status === 'urgent');
      });
    } else if (filterTab === 'active') {
      result = result.filter((o) => o.status === 'IN_PROGRESS');
    } else if (filterTab === 'ready') {
      result = result.filter((o) => o.status === 'READY');
    } else if (filterTab === 'not_started') {
      result = result.filter((o) => o.status === 'NOT_STARTED');
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'departureDate') {
        const dateA = a.departureDate || '9999-99-99';
        const dateB = b.departureDate || '9999-99-99';
        comparison = dateA.localeCompare(dateB);
      } else if (sortField === 'orderNumber') {
        comparison = a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true });
      } else if (sortField === 'client') {
        comparison = a.client.localeCompare(b.client);
      } else if (sortField === 'projectName') {
        comparison = a.projectName.localeCompare(b.projectName);
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [orders, searchQuery, filterTab, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Center Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 border-l-4 border-l-slate-400 shadow-2xs">
          <p className="text-xs text-slate-500 font-medium">Wszystkie zlecenia</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {stats.total}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/30 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs text-blue-800 font-bold">W realizacji</p>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-700 font-mono tabular-nums mt-1">
            {stats.inProgress}
          </p>
        </div>

        <div
          onClick={() => onFilterTabChange('problem')}
          className={`bg-white p-4 rounded-xl border border-l-4 border-l-rose-600 transition-all cursor-pointer shadow-2xs ${
            stats.problems > 0
              ? 'border-rose-300 bg-rose-50/50 hover:border-rose-400'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-rose-700 font-extrabold">Problemy (wymaga uwagi)</p>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
          </div>
          <p className="text-2xl font-black text-rose-600 font-mono tabular-nums mt-1">
            {stats.problems}
          </p>
        </div>

        <div
          onClick={() => onFilterTabChange('urgent')}
          className="bg-white p-4 rounded-xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/30 hover:border-amber-400 transition-all cursor-pointer shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-800 font-bold">Wyjazd ≤ 7 dni / pilne</p>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 font-mono tabular-nums mt-1">
            {stats.urgentDeparture}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50/30 shadow-2xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-emerald-800 font-bold">Gotowe</p>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 font-mono tabular-nums mt-1">
            {stats.ready}
          </p>
        </div>
      </div>

      {/* Plan Załadunków Mini Dashboard Quick Access Strip */}
      {onOpenLoadingPlan && (
        <div
          onClick={onOpenLoadingPlan}
          className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-xl p-3 sm:p-3.5 px-4 sm:px-5 border border-emerald-800/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-emerald-500/60 hover:from-emerald-900/90 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Plan Załadunków — Mini wersja dashboardu (16 obszarów)</span>
                <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded border border-emerald-400/30">
                  Kompaktowa tabela
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Kompaktowy przegląd: data wyjazdu, ZL, wkładki bezpiecznikowe, aparatura SN/nN, szafka, montaż, most, DTR i powykonawcza.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 group-hover:text-white transition-colors self-end sm:self-auto shrink-0">
            <span>Otwórz Plan Załadunków</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      )}

      {/* Door Module Quick Access Strip */}
      {onOpenDoorModule && doorOrders && (
        <div
          onClick={onOpenDoorModule}
          className="bg-slate-900 text-white rounded-xl p-3 sm:p-3.5 px-4 sm:px-5 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-blue-500/50 hover:bg-slate-850 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30 shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                <span>Moduł „Drzwi” — Rejestr zamówień PZD i dostaw</span>
                <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-300 text-[10px] font-mono rounded border border-blue-400/30">
                  {doorOrders.length} zamówień
                </span>
                {doorOrders.some((d) => checkDoorOrderOverdue(d.terminZamowienia, d.terminDostawy).isOverdue) && (
                  <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded animate-pulse">
                    Wymaga uwagi (po terminie!)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Kontrola terminów z zamówienia, potwierdzonych dostaw i przypisania do stacji ZL.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors self-end sm:self-auto shrink-0">
            <span>Otwórz rejestr drzwi</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Live Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj po numerze zlecenia (ZL...), kliencie, nazwie projektu..."
              className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Quick Segmented Status Filters */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => onFilterTabChange('all')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Wszystkie ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => onFilterTabChange('active')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterTab === 'active'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              W realizacji ({stats.inProgress})
            </button>
            <button
              type="button"
              onClick={() => onFilterTabChange('urgent')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                filterTab === 'urgent'
                  ? 'bg-white text-rose-700 font-bold shadow-xs'
                  : 'text-rose-600 hover:text-rose-800'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>Wymagające uwagi ({stats.problems + stats.urgentDeparture})</span>
            </button>
            <button
              type="button"
              onClick={() => onFilterTabChange('ready')}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterTab === 'ready'
                  ? 'bg-white text-emerald-800 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gotowe ({stats.ready})
            </button>
          </div>
        </div>

        {/* Sorting controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sortuj po:</span>
            <button
              type="button"
              onClick={() => toggleSort('departureDate')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortField === 'departureDate'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'hover:text-slate-800'
              }`}
            >
              Dacie wyjazdu {sortField === 'departureDate' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => toggleSort('orderNumber')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortField === 'orderNumber'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'hover:text-slate-800'
              }`}
            >
              Nr zlecenia {sortField === 'orderNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => toggleSort('client')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortField === 'client'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'hover:text-slate-800'
              }`}
            >
              Kliencie {sortField === 'client' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => toggleSort('status')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortField === 'status'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'hover:text-slate-800'
              }`}
            >
              Statusie {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
            </button>
          </div>

          <div className="text-slate-400">
            Wyniki: <span className="font-mono tabular-nums font-semibold text-slate-700">{filteredOrders.length}</span>
          </div>
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <Box className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">Nie znaleziono zleceń</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? 'Brak wyników pasujących do wpisanej frazy. Zmień zapytanie lub wyczyść filtry.'
              : 'W wybranej kategorii nie ma obecnie żadnych zleceń.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Wyczyść szukanie
              </button>
            )}
            <button
              type="button"
              onClick={onNewOrder}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              + Dodaj nowe zlecenie
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const hasProblem = order.items.some((i) => i.status === 'PROBLEM');
            const readyCount = order.items.filter((i) => i.status === 'READY').length;
            const inProgressCount = order.items.filter((i) => i.status === 'IN_PROGRESS').length;
            const orderedCount = order.items.filter((i) => i.status === 'ORDERED').length;
            const notOrderedCount = order.items.filter((i) => i.status === 'NOT_ORDERED').length;
            const problemCount = order.items.filter((i) => i.status === 'PROBLEM').length;
            const totalCount = order.items.length;
            const percentReady = totalCount > 0 ? Math.round((readyCount / totalCount) * 100) : 0;

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder(order.id)}
                className={`group bg-white rounded-xl border transition-all cursor-pointer shadow-2xs hover:shadow-md ${
                  hasProblem
                    ? 'border-rose-400 border-l-4 border-l-rose-600 bg-rose-50/20 hover:border-rose-500'
                    : order.status === 'READY'
                    ? 'border-emerald-300 border-l-4 border-l-emerald-600 bg-emerald-50/15 hover:border-emerald-400'
                    : 'border-slate-300 border-l-4 border-l-blue-600 hover:border-blue-400'
                }`}
              >
                <div className="p-4 sm:p-5">
                  {/* Top Bar: Order ID, Project Name, Overall Status & Departure */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300">
                          {order.orderNumber}
                        </span>
                        <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {order.projectName}
                        </h2>
                      </div>
                      <span className="text-slate-300 hidden sm:inline">|</span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-semibold text-slate-800">{order.client}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono text-slate-700">{order.stationSize}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <DepartureBadge
                        dateStr={order.departureDate}
                        isCompleted={order.status === 'READY'}
                      />
                      <OrderStatusBadge status={order.status} size="sm" />
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  {/* Element Completeness Bar & Badges */}
                  <div className="mt-3.5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800">Kompletacja stacji:</span>
                        <span className="font-mono tabular-nums font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {readyCount}/{totalCount} gotowe ({percentReady}%)
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        {problemCount > 0 && (
                          <span className="text-white bg-rose-600 px-2 py-0.5 rounded shadow-2xs flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            {problemCount} {problemCount === 1 ? 'problem' : 'problemy'}
                          </span>
                        )}
                        <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          {readyCount} gotowe
                        </span>
                        {inProgressCount > 0 && (
                          <span className="text-amber-950 bg-amber-200/90 px-2 py-0.5 rounded border border-amber-400 font-extrabold">
                            {inProgressCount} w realizacji
                          </span>
                        )}
                        <span className="text-blue-800 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                          {orderedCount} zlecone
                        </span>
                        <span className="text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium">
                          {notOrderedCount} nie zlecone
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with vibrant colors */}
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${(readyCount / totalCount) * 100}%` }}
                        title={`${readyCount} gotowe`}
                      />
                      <div
                        className="bg-amber-500 h-full transition-all duration-300"
                        style={{ width: `${(inProgressCount / totalCount) * 100}%` }}
                        title={`${inProgressCount} w realizacji`}
                      />
                      <div
                        className="bg-blue-600 h-full transition-all duration-300"
                        style={{ width: `${(orderedCount / totalCount) * 100}%` }}
                        title={`${orderedCount} zlecone/zamówione`}
                      />
                      {problemCount > 0 && (
                        <div
                          className="bg-rose-600 h-full transition-all duration-300 animate-pulse"
                          style={{ width: `${(problemCount / totalCount) * 100}%` }}
                          title={`${problemCount} problem`}
                        />
                      )}
                    </div>

                    {/* Tablica etapów w stylu tablicy przystankowej: ukośne nazwy i jeden rząd znaczników */}
                    <div className="pt-2 overflow-x-auto">
                      <div className="flex min-w-max items-end border-b border-slate-200 pb-1">
                        {order.items.map((it) => {
                          const meta = (it.status && STATUS_META[it.status]) || STATUS_META.NOT_ORDERED;
                          const dotColor =
                            it.status === 'PROBLEM' ? 'bg-rose-600 ring-2 ring-rose-200' :
                            it.status === 'READY' ? 'bg-emerald-600' :
                            it.status === 'IN_PROGRESS' ? 'bg-amber-500 ring-2 ring-amber-100' :
                            it.status === 'ORDERED' ? 'bg-blue-600' :
                            'bg-slate-300';

                          return (
                            <div
                              key={it.id}
                              className="relative flex h-[112px] w-[38px] shrink-0 flex-col items-center justify-end"
                              title={`${it.name || 'Element'}: ${meta?.label || 'Nie określono'}${it.notes ? ` (${it.notes})` : ''}`}
                            >
                              <div className="absolute bottom-[25px] left-1/2 w-[100px] origin-bottom-left -translate-x-0 -rotate-45">
                                <span className="block max-w-[100px] truncate text-[10px] font-semibold leading-3 text-slate-700">
                                  {it.shortName || it.name}
                                </span>
                              </div>
                              <span className={`mb-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotColor}`} />
                              <span className="h-1.5 w-px bg-slate-300" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* General notes preview if any */}
                  {order.generalNotes && (
                    <div className="mt-3 pt-2 border-t border-slate-100 text-xs text-slate-500 truncate">
                      <span className="font-semibold text-slate-700">Uwagi: </span>
                      <span>{order.generalNotes}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
