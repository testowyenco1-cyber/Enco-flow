import React, { useState, useMemo, useEffect } from 'react';
import {
  Order,
  OrderStatus,
  ItemStatus,
  STATUS_META,
  getDepartureDateUrgency,
  DoorOrder,
  ITEM_DEFINITIONS,
  formatDatePL,
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
import { isSameOrderNumber } from '../utils/orderNumberUtils';

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

type ActionDepartmentKey = 'sales' | 'technical' | 'logistics' | 'pyskowice' | 'plochocinska' | 'all';

interface DashboardAction {
  id: string;
  orderId: string;
  orderNumber: string;
  client: string;
  projectName: string;
  actionType: string;
  itemLabel: string;
  department: Exclude<ActionDepartmentKey, 'all'>;
  plannedDate?: string;
  createdAt: string;
  priority: 'overdue' | 'problem' | 'today' | 'soon' | 'planned' | 'no-date';
  reason: string;
  source: 'item' | 'door';
}

const ACTION_DEPARTMENTS: Array<{ value: ActionDepartmentKey; label: string }> = [
  { value: 'all', label: 'Wszystkie działy' },
  { value: 'sales', label: 'Dział Handlowy (DH/MW)' },
  { value: 'technical', label: 'Techniczny — projektant DH' },
  { value: 'logistics', label: 'Logistyka' },
  { value: 'plochocinska', label: 'Produkcja Płochocińska' },
  { value: 'pyskowice', label: 'Fabryka Pyskowice' },
];

const ACTION_DEPARTMENT_LABELS: Record<Exclude<ActionDepartmentKey, 'all'>, string> = {
  sales: 'DH / MW',
  technical: 'Techniczny',
  logistics: 'Logistyka',
  plochocinska: 'Płochocińska',
  pyskowice: 'Pyskowice',
};

function getDefaultActionDepartment(roleId?: string): ActionDepartmentKey {
  switch (roleId) {
    case 'dzial_handlowy': return 'sales';
    case 'logistyka': return 'logistics';
    case 'pyskowice': return 'pyskowice';
    case 'plochocinska': return 'plochocinska';
    default: return 'all';
  }
}

function localDayDifference(dateValue?: string): number | null {
  if (!dateValue) return null;
  const cleanDate = String(dateValue).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;
  const target = new Date(cleanDate + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function hasTruthyDetail(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['true', 'tak', 'yes', '1', 'gotowe', 'dostarczono', 'w pyskowicach'].includes(normalized);
}

function getItemPlannedDate(item: Order['items'][number], order: Order): string | undefined {
  if (item.plannedDate) return String(item.plannedDate).slice(0, 10);
  const details = item.details || {};
  const dateKeys = [
    'dataDostawyPlan',
    'dataPlDostawyPyskowice',
    'planowanaGotowoscTransportu',
    'dataGotowosci',
    'dataOczekiwana',
    'dataTransportu',
    'terminRealizacji',
  ];
  for (const key of dateKeys) {
    const value = details[key];
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  }
  if (item.type === 'DATA_WYJAZDU' && order.departureDate) return order.departureDate;
  return undefined;
}

/**
 * Wstępne przypisanie działu do podpowiedzi działań.
 * To heurystyka oparta na istniejących typach i polach, a nie zatwierdzony obieg obowiązków.
 */
function getActionDepartment(
  item: Order['items'][number],
  phase: 'start' | 'monitor' | 'problem'
): Exclude<ActionDepartmentKey, 'all'> {
  const details = item.details || {};
  if (item.type === 'POWYKONAWCZA') return 'technical';
  if (item.type === 'DATA_WYJAZDU') return 'logistics';
  if (item.type === 'ZLECENIE_MONTAZU') return 'pyskowice';
  if (phase === 'start') return 'sales';
  if (item.type === 'OBUDOWA') return 'pyskowice';
  if (item.type === 'ROZDZIELNICA_NN') {
    if (hasTruthyDetail(details.nnWPyskowicach)) return 'pyskowice';
    if (details.dataGotowosciFakt || details.planowanaGotowoscTransportu) return 'logistics';
    return 'plochocinska';
  }
  if (item.type === 'ROZDZIELNICA_SN') {
    if (hasTruthyDetail(details.snWPyskowicach)) return 'pyskowice';
    return 'logistics';
  }
  if (item.type === 'SZAFKA_TELEMECHANIKI') {
    if (hasTruthyDetail(details.szafkaWPyskowicach)) return 'pyskowice';
    if (details.dataGotowosciDokumentacji && !details.dataGotowosci) return 'sales';
    return 'logistics';
  }
  if (item.type === 'TABLICA_POMIAROWA' && hasTruthyDetail(details.wPyskowicach)) return 'pyskowice';
  if (item.type === 'RPW' && hasTruthyDetail(details.wPyskowicach)) return 'pyskowice';
  if (item.type === 'TRANSFORMATOR_POTRZEB_WLASNYCH' && hasTruthyDetail(details.wPyskowicach)) return 'pyskowice';
  if (item.type === 'WSKAZNIKI_ZWARC' && hasTruthyDetail(details.wPyskowicach)) return 'pyskowice';
  if (item.type === 'MOST' && hasTruthyDetail(details.mostSNPyskowicach)) return 'pyskowice';
  if (item.type === 'DRZWI') return 'logistics';
  if (item.type === 'RYS_AKCEPTACJA' || item.type === 'KOLORY' || item.type === 'OPISY') return 'sales';
  return phase === 'problem' ? 'sales' : 'logistics';
}

function getDashboardPriority(date?: string): DashboardAction['priority'] {
  const days = localDayDifference(date);
  if (days === null) return 'no-date';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  return 'planned';
}

/**
 * Buduje listę czynności z aktualnych statusów zleceń.
 * Nie zapisuje osobnych zadań i nie zmienia statusów źródłowych.
 */
function buildDashboardActions(orders: Order[], doorOrders: DoorOrder[]): DashboardAction[] {
  const actions: DashboardAction[] = [];
  const activeOrders = orders.filter((order) => order.status !== 'READY');

  activeOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (item.status === 'READY' || item.status === 'NOT_APPLICABLE') return;

      const definition = ITEM_DEFINITIONS.find((entry) => entry.type === item.type);
      const itemLabel = item.name || (definition ? definition.name : item.type);
      const itemDate = getItemPlannedDate(item, order);
      const daysToDate = localDayDifference(itemDate);
      const hasLinkedDoorOrder = item.type === 'DRZWI' && doorOrders.some((door) =>
        (door.numeryZl || []).some((number) => isSameOrderNumber(number, order.orderNumber))
      );

      // Jeżeli istnieje rejestr zamówienia drzwi, źródłem prawdy dla dostawy jest moduł Drzwi.
      if (item.type === 'DRZWI' && hasLinkedDoorOrder && item.status !== 'PROBLEM') return;

      let actionType = '';
      let department: Exclude<ActionDepartmentKey, 'all'> = 'sales';
      let reason = '';
      let priority: DashboardAction['priority'] = getDashboardPriority(itemDate);

      if (item.status === 'PROBLEM') {
        actionType = 'Wyjaśnić problem: ' + itemLabel;
        department = getActionDepartment(item, 'problem');
        reason = item.notes ? String(item.notes) : 'Element ma status „Problem”.';
        priority = 'problem';
      } else if (item.status === 'NOT_ORDERED') {
        actionType = 'Zlecić / rozpocząć: ' + itemLabel;
        department = getActionDepartment(item, 'start');
        reason = 'Element nie został jeszcze zlecony ani oznaczony jako niewymagany.';
      } else if (item.status === 'ORDERED' || item.status === 'IN_PROGRESS') {
        // Pokazujemy działania bez terminu do uzupełnienia oraz te, które wymagają reakcji w ciągu 7 dni.
        if (!itemDate) {
          actionType = 'Ustalić termin: ' + itemLabel;
          reason = 'Brak przewidywanej daty dla etapu w realizacji.';
          priority = 'no-date';
        } else if (daysToDate === null) {
          actionType = 'Sprawdzić termin: ' + itemLabel;
          reason = 'Zapisany termin wymaga sprawdzenia.';
          priority = 'no-date';
        } else if (daysToDate <= 7) {
          actionType = item.status === 'ORDERED'
            ? 'Sprawdzić realizację / dostawę: ' + itemLabel
            : 'Dopilnować zakończenia: ' + itemLabel;
          reason = daysToDate < 0
            ? 'Przewidywany termin minął.'
            : daysToDate === 0
              ? 'Termin przypada dzisiaj.'
              : 'Termin przypada w ciągu najbliższych 7 dni.';
        } else {
          return;
        }
        department = getActionDepartment(item, 'monitor');
      } else {
        return;
      }

      actions.push({
        id: 'item:' + order.id + ':' + item.id + ':' + actionType,
        orderId: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        projectName: order.projectName,
        actionType,
        itemLabel,
        department,
        plannedDate: itemDate,
        createdAt: item.createdAt || order.createdAt,
        priority,
        reason,
        source: 'item',
      });
    });
  });

  // Dostawy drzwi pokazujemy w kontekście aktywnych zleceń, do których zostały przypięte.
  doorOrders.forEach((door) => {
    if (door.terminDostawy && door.terminDostawy.trim()) return;
    const linkedOrders = orders.filter((order) =>
      (door.numeryZl || []).some((number) => isSameOrderNumber(number, order.orderNumber))
    );
    if (linkedOrders.length === 0) return;

    const dueDate = door.terminZamowienia || '';
    const daysToDue = localDayDifference(dueDate);
    if (dueDate && daysToDue !== null && daysToDue > 7) return;

    linkedOrders.forEach((order) => {
      const actionType = dueDate
        ? (daysToDue !== null && daysToDue < 0 ? 'Wyjaśnić opóźnienie dostawy drzwi' : 'Potwierdzić dostawę drzwi')
        : 'Ustalić termin dostawy drzwi';
      actions.push({
        id: 'door:' + door.id + ':' + order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        client: order.client,
        projectName: order.projectName,
        actionType,
        itemLabel: 'Drzwi · ' + (door.numerDokumentu || 'zamówienie bez numeru'),
        department: 'logistics',
        plannedDate: dueDate || undefined,
        createdAt: door.createdAt || order.createdAt,
        priority: getDashboardPriority(dueDate),
        reason: dueDate
          ? (daysToDue !== null && daysToDue < 0 ? 'Minął termin, a dostawa nie została potwierdzona.' : 'Brak potwierdzenia faktycznej dostawy.')
          : 'Nie wpisano oczekiwanego terminu dostawy.',
        source: 'door',
      });
    });
  });

  return actions;
}

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
  const [actionDepartment, setActionDepartment] = useState<ActionDepartmentKey>(() => getDefaultActionDepartment(profile.id));
  const [actionSearch, setActionSearch] = useState('');
  const [actionSortField, setActionSortField] = useState<'orderNumber' | 'actionType' | 'department' | 'plannedDate' | 'createdAt'>('plannedDate');
  const [actionSortOrder, setActionSortOrder] = useState<SortOrder>('asc');

  // Po zmianie profilu przywracamy domyślny widok jego działu.
  useEffect(() => {
    setActionDepartment(getDefaultActionDepartment(profile.id));
  }, [profile.id]);

  const dashboardActions = useMemo(() => buildDashboardActions(orders, doorOrders || []), [orders, doorOrders]);
  const filteredDashboardActions = useMemo(() => {
    const query = actionSearch.trim().toLowerCase();
    const result = dashboardActions.filter((action) => {
      if (actionDepartment !== 'all' && action.department !== actionDepartment) return false;
      if (!query) return true;
      return [
        action.orderNumber,
        action.client,
        action.projectName,
        action.actionType,
        action.itemLabel,
        action.reason,
        ACTION_DEPARTMENT_LABELS[action.department],
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (actionSortField === 'orderNumber') {
        comparison = a.orderNumber.localeCompare(b.orderNumber, 'pl', { numeric: true });
      } else if (actionSortField === 'actionType') {
        comparison = a.actionType.localeCompare(b.actionType, 'pl');
      } else if (actionSortField === 'department') {
        comparison = ACTION_DEPARTMENT_LABELS[a.department].localeCompare(ACTION_DEPARTMENT_LABELS[b.department], 'pl');
      } else {
        const valueA = actionSortField === 'plannedDate' ? a.plannedDate : a.createdAt;
        const valueB = actionSortField === 'plannedDate' ? b.plannedDate : b.createdAt;
        // Brak terminu zawsze zostaje na końcu, niezależnie od kierunku sortowania.
        if (actionSortField === 'plannedDate' && Boolean(valueA) !== Boolean(valueB)) {
          return valueA ? -1 : 1;
        }
        comparison = String(valueA || '').localeCompare(String(valueB || ''));
      }
      return actionSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [dashboardActions, actionDepartment, actionSearch, actionSortField, actionSortOrder]);

  const toggleActionSort = (field: 'orderNumber' | 'actionType' | 'department' | 'plannedDate' | 'createdAt') => {
    if (actionSortField === field) {
      setActionSortOrder((current) => current === 'asc' ? 'desc' : 'asc');
    } else {
      setActionSortField(field);
      setActionSortOrder(field === 'createdAt' ? 'desc' : 'asc');
    }
  };
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
      {/* ENCO_ACTION_DASHBOARD_V1 — lista kolejnych czynności wynikająca z bieżących danych */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0"><ArrowUpDown className="w-5 h-5" /></div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">Plan działań</h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Lista czynności do podjęcia w niezakończonych zleceniach. Priorytetowo pokazuje nierozpoczęte etapy, problemy, brakujące terminy i działania z terminem w ciągu 7 dni.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600">Widoczne: <strong className="text-slate-900">{filteredDashboardActions.length}</strong></span>
              <span className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">Po terminie: <strong>{filteredDashboardActions.filter((action) => action.priority === 'overdue').length}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 mt-4">
            <div className="relative min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={actionSearch}
                onChange={(event) => setActionSearch(event.target.value)}
                placeholder="Szukaj ZL, działania, projektu..."
                className="w-full min-w-0 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <select
              aria-label="Filtruj działania według działu"
              value={actionDepartment}
              onChange={(event) => setActionDepartment(event.target.value as ActionDepartmentKey)}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {ACTION_DEPARTMENTS.map((department) => <option key={department.value} value={department.value}>{department.label}</option>)}
            </select>
            <select
              aria-label="Sortuj działania"
              value={actionSortField}
              onChange={(event) => {
                const field = event.target.value as typeof actionSortField;
                setActionSortField(field);
                setActionSortOrder(field === 'createdAt' ? 'desc' : 'asc');
              }}
              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="orderNumber">Sortuj: numer ZL</option>
              <option value="actionType">Sortuj: rodzaj działania</option>
              <option value="department">Sortuj: dział</option>
              <option value="plannedDate">Sortuj: przewidywana data wykonania</option>
              <option value="createdAt">Sortuj: data dodania elementu</option>
            </select>
            <button
              type="button"
              onClick={() => setActionSortOrder((current) => current === 'asc' ? 'desc' : 'asc')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              title="Zmień kierunek sortowania"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {actionSortOrder === 'asc' ? 'Rosnąco' : 'Malejąco'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Domyślnie pokazujemy dział przypisany do zalogowanego profilu. Możesz wybrać inny dział lub wszystkie działy. Lista jest wyliczana z aktualnych statusów — na tym etapie nie tworzy osobnych, zapisywanych zadań.
          </p>
        </div>

        {filteredDashboardActions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Brak czynności spełniających wybrane kryteria</h3>
            <p className="text-xs text-slate-500 mt-1">Zmień dział, wyszukiwanie lub sprawdź dane i statusy elementów w zleceniach.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-bold">ZL / projekt</th>
                  <th className="px-4 py-3 font-bold">Rodzaj działania</th>
                  <th className="px-4 py-3 font-bold">Dział</th>
                  <th className="px-4 py-3 font-bold">Przewidywana data</th>
                  <th className="px-4 py-3 font-bold">Dodano element</th>
                  <th className="px-4 py-3 font-bold">Stan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDashboardActions.map((action) => (
                  <tr key={action.id} className="align-top hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => action.source === 'door' && onOpenDoorModule ? onOpenDoorModule() : onSelectOrder(action.orderId)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline text-left whitespace-nowrap"
                      >
                        {action.orderNumber}
                      </button>
                      <div className="text-[11px] text-slate-500 mt-1 max-w-[180px] whitespace-normal">{action.projectName || action.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 whitespace-normal min-w-[220px]">{action.actionType}</div>
                      <div className="text-[11px] text-slate-500 mt-1 whitespace-normal max-w-sm">{action.reason}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                        {ACTION_DEPARTMENT_LABELS[action.department]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{action.plannedDate ? formatDatePL(action.plannedDate) : <span className="text-amber-700">Nie ustalono</span>}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{action.createdAt ? formatDatePL(action.createdAt.slice(0, 10)) : '—'}</td>
                    <td className="px-4 py-3">
                      {action.priority === 'overdue' ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 whitespace-nowrap">Po terminie</span>
                      ) : action.priority === 'problem' ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700 whitespace-nowrap">Problem</span>
                      ) : action.priority === 'today' ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 whitespace-nowrap">Na dziś</span>
                      ) : action.priority === 'soon' ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800 whitespace-nowrap">Najbliższe 7 dni</span>
                      ) : action.priority === 'no-date' ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 whitespace-nowrap">Brak terminu</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700 whitespace-nowrap">Do wykonania</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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

                    {/* Compact Item Matrix Strip (Poziom 1 Control Center format) with solid vibrant badges */}
                    <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                      {order.items.map((it) => {
                        const meta = (it.status && STATUS_META[it.status]) || STATUS_META.NOT_ORDERED;
                        const isProb = it.status === 'PROBLEM';
                        const isRdy = it.status === 'READY';
                        const isInProg = it.status === 'IN_PROGRESS';
                        const isOrd = it.status === 'ORDERED';

                        let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-300 font-bold';
                        let dotStyle = 'bg-slate-400';

                        if (isProb) {
                          badgeStyle = 'bg-rose-600 text-white border-rose-700 font-black shadow-2xs ring-1 ring-rose-400 animate-pulse';
                          dotStyle = 'bg-white';
                        } else if (isRdy) {
                          badgeStyle = 'bg-emerald-600 text-white border-emerald-700 font-black shadow-2xs';
                          dotStyle = 'bg-white';
                        } else if (isInProg) {
                          badgeStyle = 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs ring-1 ring-amber-400/50';
                          dotStyle = 'bg-slate-950';
                        } else if (isOrd) {
                          badgeStyle = 'bg-blue-600 text-white border-blue-700 font-black shadow-2xs';
                          dotStyle = 'bg-white';
                        }

                        return (
                          <div
                            key={it.id}
                            title={`${it.name || 'Element'}: ${meta?.label || 'Nie określono'}${it.notes ? ` (${it.notes})` : ''}`}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border tracking-tight ${badgeStyle}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${dotStyle}`} />
                            <span>{it.shortName || it.name}</span>
                          </div>
                        );
                      })}
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
