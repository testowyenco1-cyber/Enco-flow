import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, Search, ArrowUpDown } from 'lucide-react';
import { Order, DoorOrder, ITEM_DEFINITIONS, formatDatePL } from '../types/enco';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';
import { isSameOrderNumber } from '../utils/orderNumberUtils';

interface ActionDashboardViewProps {
  orders: Order[];
  doorOrders?: DoorOrder[];
  onSelectOrder: (orderId: string) => void;
  onOpenDoorModule?: () => void;
  currentProfile?: UserRoleProfile;
}

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

function getStartActionLabel(itemType: string, itemLabel: string): string {
  const labels: Record<string, string> = {
    OBUDOWA: 'Zlecić / potwierdzić obudowę',
    ROZDZIELNICA_SN: 'Zlecić rozdzielnicę SN',
    ROZDZIELNICA_NN: 'Zlecić rozdzielnicę NN',
    TABLICA_POMIAROWA: 'Zlecić tablicę pomiarową',
    RPW: 'Zlecić / przygotować RPW',
    MOST: 'Zlecić most kablowy',
    SZAFKA_TELEMECHANIKI: 'Zlecić szafkę telemechaniki',
    TRANSFORMATOR_POTRZEB_WLASNYCH: 'Zamówić transformator potrzeb własnych',
    WSKAZNIKI_ZWARC: 'Zamówić wskaźniki zwarcia',
    RYS_AKCEPTACJA: 'Przygotować / uzyskać akceptację rysunków',
    KOLORY: 'Potwierdzić kolorystykę i numery RAL',
    OPISY: 'Ustalić wymagane opisy i tabliczki',
    DRZWI: 'Sprawdzić / zlecić drzwi',
    ZAP_SERWISPOL: 'Wysłać zapytanie do SERWISPOL',
    ZAM_SERWISPOL: 'Złożyć zamówienie SERWISPOL',
    ZAP_JK: 'Uzyskać wycenę JK',
    ZAM_JK: 'Zamówić usługę JK',
    ZLECENIE_MONTAZU: 'Przygotować zlecenie montażu',
    POWYKONAWCZA: 'Przygotować dokumentację powykonawczą',
    DATA_WYJAZDU: 'Ustalić plan transportu i wyjazdu stacji',
    DODATKOWE: 'Zweryfikować wyposażenie dodatkowe',
  };
  return labels[itemType] || 'Sprawdzić / rozpocząć: ' + itemLabel;
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
        actionType = getStartActionLabel(item.type, itemLabel);
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

export const ActionDashboardView: React.FC<ActionDashboardViewProps> = ({
  orders,
  doorOrders = [],
  onSelectOrder,
  onOpenDoorModule,
  currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const [actionDepartment, setActionDepartment] = useState<ActionDepartmentKey>(() => getDefaultActionDepartment(profile.id));
  const [actionSearch, setActionSearch] = useState('');
  const [actionSortField, setActionSortField] = useState<'orderNumber' | 'actionType' | 'department' | 'plannedDate' | 'createdAt'>('plannedDate');
  const [actionSortOrder, setActionSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    setActionDepartment(getDefaultActionDepartment(profile.id));
  }, [profile.id]);

  const dashboardActions = useMemo(() => buildDashboardActions(orders, doorOrders), [orders, doorOrders]);
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
        if (actionSortField === 'plannedDate' && Boolean(valueA) !== Boolean(valueB)) {
          return valueA ? -1 : 1;
        }
        comparison = String(valueA || '').localeCompare(String(valueB || ''));
      }
      return actionSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [dashboardActions, actionDepartment, actionSearch, actionSortField, actionSortOrder]);

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
                        onClick={() => onSelectOrder(action.orderId)}
                        className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline text-left whitespace-nowrap"
                      >
                        {action.orderNumber}
                      </button>
                      <div className="text-[11px] text-slate-500 mt-1 max-w-[180px] whitespace-normal">{action.projectName || action.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-slate-800 whitespace-normal min-w-[220px]">{action.actionType}</div>
                      <div className="text-[11px] text-slate-500 mt-1 whitespace-normal max-w-sm">{action.reason}</div>
                      {action.source === 'door' && onOpenDoorModule && (
                        <button type="button" onClick={onOpenDoorModule} className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline">
                          Otwórz moduł Drzwi
                        </button>
                      )}
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
    </div>
  );
};
