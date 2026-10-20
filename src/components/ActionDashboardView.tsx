import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, CheckCircle2, Search } from 'lucide-react';
import { DoorOrder, ITEM_DEFINITIONS, Order, formatDatePL } from '../types/enco';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';
import { isSameOrderNumber } from '../utils/orderNumberUtils';

type DepartmentKey = 'all' | 'sales' | 'technical' | 'logistics' | 'plochocinska' | 'pyskowice';
type SortKey = 'orderNumber' | 'actionType' | 'department' | 'plannedDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';
type ActionPriority = 'problem' | 'overdue' | 'today' | 'soon' | 'planned' | 'no-date';

interface ActionRow {
  id: string;
  orderId: string;
  orderNumber: string;
  projectName: string;
  client: string;
  actionType: string;
  department: Exclude<DepartmentKey, 'all'>;
  plannedDate: string;
  createdAt: string;
  priority: ActionPriority;
  reason: string;
  source: 'item' | 'door';
}

interface Props {
  orders: Order[];
  doorOrders?: DoorOrder[];
  onSelectOrder: (orderId: string) => void;
  onOpenDoorModule?: () => void;
  currentProfile?: UserRoleProfile;
}

const DEPARTMENTS: Array<{ value: DepartmentKey; label: string }> = [
  { value: 'all', label: 'Wszystkie działy' },
  { value: 'sales', label: 'Dział Handlowy (DH/MW)' },
  { value: 'technical', label: 'Techniczny — projektant DH' },
  { value: 'logistics', label: 'Logistyka' },
  { value: 'plochocinska', label: 'Produkcja Płochocińska' },
  { value: 'pyskowice', label: 'Fabryka Pyskowice' },
];

const DEPARTMENT_NAMES: Record<Exclude<DepartmentKey, 'all'>, string> = {
  sales: 'DH / MW',
  technical: 'Techniczny',
  logistics: 'Logistyka',
  plochocinska: 'Płochocińska',
  pyskowice: 'Pyskowice',
};

const START_ACTIONS: Record<string, string> = {
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

function getDefaultDepartment(roleId?: string): DepartmentKey {
  if (roleId === 'dzial_handlowy') return 'sales';
  if (roleId === 'logistyka') return 'logistics';
  if (roleId === 'pyskowice') return 'pyskowice';
  if (roleId === 'plochocinska') return 'plochocinska';
  return 'all';
}

function asDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const clean = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}

function daysFromToday(date: string): number | null {
  if (!date) return null;
  const target = new Date(date + 'T00:00:00');
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function priorityFor(date: string): ActionPriority {
  const days = daysFromToday(date);
  if (days === null) return 'no-date';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  return 'planned';
}

function departmentFor(itemType: string, phase: 'start' | 'monitor' | 'problem', item?: Order['items'][number]): Exclude<DepartmentKey, 'all'> {
  if (phase === 'start') return 'sales';
  if (itemType === 'POWYKONAWCZA') return 'technical';
  if (itemType === 'DATA_WYJAZDU') return 'logistics';
  if (itemType === 'ZLECENIE_MONTAZU') return 'pyskowice';
  if (itemType === 'OBUDOWA') return 'pyskowice';
  if (itemType === 'ROZDZIELNICA_NN' && item) {
    const details: Record<string, any> = item.details && typeof item.details === 'object' ? item.details : {};
    if (details.nnWPyskowicach === true || details.nnWPyskowicach === 'tak') return 'pyskowice';
    if (details.dataGotowosciFakt || details.planowanaGotowoscTransportu) return 'logistics';
    return 'plochocinska';
  }
  if (itemType === 'ROZDZIELNICA_SN') return 'logistics';
  if (itemType === 'RYS_AKCEPTACJA' || itemType === 'KOLORY' || itemType === 'OPISY') return 'sales';
  if (itemType === 'DRZWI' || itemType === 'MOST' || itemType === 'SZAFKA_TELEMECHANIKI') return 'logistics';
  return phase === 'problem' ? 'sales' : 'logistics';
}

function plannedDateFor(item: Order['items'][number], order: Order): string {
  const directDate = asDate(item.plannedDate);
  if (directDate) return directDate;
  const details = item.details && typeof item.details === 'object' ? item.details : {};
  const keys = ['dataDostawyPlan', 'dataPlDostawyPyskowice', 'planowanaGotowoscTransportu', 'dataOczekiwana', 'terminRealizacji'];
  for (const key of keys) {
    const value = asDate(details[key]);
    if (value) return value;
  }
  return item.type === 'DATA_WYJAZDU' ? asDate(order.departureDate) : '';
}

function buildActions(orders: Order[], doorOrders: DoorOrder[]): ActionRow[] {
  const actions: ActionRow[] = [];
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safeDoors = Array.isArray(doorOrders) ? doorOrders : [];

  safeOrders.filter((order) => order && !order.archivedAt && order.status !== 'READY').forEach((order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    items.filter(Boolean).forEach((item) => {
      if (!item || item.status === 'READY' || item.status === 'NOT_APPLICABLE') return;
      const definition = ITEM_DEFINITIONS.find((entry) => entry.type === item.type);
      const itemName = item.name || (definition ? definition.name : item.type);
      const plannedDate = plannedDateFor(item, order);
      const days = daysFromToday(plannedDate);
      const hasDoorRegister = item.type === 'DRZWI' && safeDoors.some((door) =>
        door && Array.isArray(door.numeryZl) && door.numeryZl.some((zl) => isSameOrderNumber(zl, order.orderNumber))
      );
      if (item.type === 'DRZWI' && hasDoorRegister && item.status !== 'PROBLEM') return;

      let actionType = '';
      let reason = '';
      let priority = priorityFor(plannedDate);
      let department = departmentFor(item.type, 'monitor', item);

      if (item.status === 'PROBLEM') {
        actionType = 'Wyjaśnić problem: ' + itemName;
        reason = item.notes || 'Element ma status „Problem”.';
        priority = 'problem';
        department = departmentFor(item.type, 'problem', item);
      } else if (item.status === 'NOT_ORDERED') {
        actionType = START_ACTIONS[item.type] || 'Sprawdzić / rozpocząć: ' + itemName;
        reason = 'Element nie został jeszcze zlecony ani oznaczony jako niewymagany.';
        department = departmentFor(item.type, 'start', item);
      } else if (item.status === 'ORDERED' || item.status === 'IN_PROGRESS') {
        if (!plannedDate) {
          actionType = 'Ustalić termin: ' + itemName;
          reason = 'Brak przewidywanej daty dla etapu w realizacji.';
          priority = 'no-date';
        } else if (days !== null && days <= 7) {
          actionType = item.status === 'ORDERED' ? 'Sprawdzić realizację / dostawę: ' + itemName : 'Dopilnować zakończenia: ' + itemName;
          reason = days < 0 ? 'Przewidywany termin minął.' : days === 0 ? 'Termin przypada dzisiaj.' : 'Termin przypada w ciągu najbliższych 7 dni.';
        } else {
          return;
        }
      } else {
        return;
      }

      actions.push({
        id: 'item:' + order.id + ':' + item.id + ':' + actionType,
        orderId: order.id,
        orderNumber: order.orderNumber || 'Bez numeru ZL',
        projectName: order.projectName || '',
        client: order.client || '',
        actionType,
        department,
        plannedDate,
        createdAt: asDate(item.createdAt) || asDate(order.createdAt),
        priority,
        reason,
        source: 'item',
      });
    });
  });

  safeDoors.filter((door) => door && !(door.terminDostawy || '').trim()).forEach((door) => {
    const linkedOrders = safeOrders.filter((order) =>
      order && !order.archivedAt && (Array.isArray(door.numeryZl) ? door.numeryZl : []).some((zl) => isSameOrderNumber(zl, order.orderNumber))
    );
    if (!linkedOrders.length) return;
    const dueDate = asDate(door.terminZamowienia);
    const days = daysFromToday(dueDate);
    if (dueDate && days !== null && days > 7) return;

    linkedOrders.forEach((order) => {
      actions.push({
        id: 'door:' + door.id + ':' + order.id,
        orderId: order.id,
        orderNumber: order.orderNumber || 'Bez numeru ZL',
        projectName: order.projectName || '',
        client: order.client || '',
        actionType: !dueDate ? 'Ustalić termin dostawy drzwi' : days !== null && days < 0 ? 'Wyjaśnić opóźnienie dostawy drzwi' : 'Potwierdzić dostawę drzwi',
        department: 'logistics',
        plannedDate: dueDate,
        createdAt: asDate(door.createdAt) || asDate(order.createdAt),
        priority: priorityFor(dueDate),
        reason: !dueDate ? 'Nie wpisano oczekiwanego terminu dostawy.' : days !== null && days < 0 ? 'Minął termin, a dostawa nie została potwierdzona.' : 'Brak potwierdzenia faktycznej dostawy.',
        source: 'door',
      });
    });
  });

  return actions;
}

export const ActionDashboardView: React.FC<Props> = ({
  orders,
  doorOrders = [],
  onSelectOrder,
  onOpenDoorModule,
  currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const [department, setDepartment] = useState<DepartmentKey>(() => getDefaultDepartment(profile.id));
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('plannedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    setDepartment(getDefaultDepartment(profile.id));
  }, [profile.id]);

  const allActions = useMemo(() => buildActions(orders, doorOrders), [orders, doorOrders]);
  const visibleActions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl');
    const filtered = allActions.filter((action) => {
      if (department !== 'all' && action.department !== department) return false;
      if (!query) return true;
      return [action.orderNumber, action.projectName, action.client, action.actionType, action.reason, DEPARTMENT_NAMES[action.department]]
        .some((value) => String(value || '').toLocaleLowerCase('pl').includes(query));
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'orderNumber') comparison = a.orderNumber.localeCompare(b.orderNumber, 'pl', { numeric: true });
      else if (sortKey === 'actionType') comparison = a.actionType.localeCompare(b.actionType, 'pl');
      else if (sortKey === 'department') comparison = DEPARTMENT_NAMES[a.department].localeCompare(DEPARTMENT_NAMES[b.department], 'pl');
      else {
        const aValue = sortKey === 'plannedDate' ? a.plannedDate : a.createdAt;
        const bValue = sortKey === 'plannedDate' ? b.plannedDate : b.createdAt;
        if (sortKey === 'plannedDate' && Boolean(aValue) !== Boolean(bValue)) return aValue ? -1 : 1;
        comparison = aValue.localeCompare(bValue);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [allActions, department, search, sortKey, sortDirection]);

  const changeSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection(key === 'createdAt' ? 'desc' : 'asc');
    }
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">Plan działań</h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">Czynności wynikające z bieżących statusów i terminów aktywnych zleceń. To lista do planowania dnia, nie osobny zapis zadań.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600">Czynności: <strong className="text-slate-900">{visibleActions.length}</strong></span>
              <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">Po terminie: <strong>{visibleActions.filter((item) => item.priority === 'overdue').length}</strong></span>
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">Problemy: <strong>{visibleActions.filter((item) => item.priority === 'problem').length}</strong></span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj ZL, działania, projektu..." className="w-full min-w-0 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <select aria-label="Filtruj działania według działu" value={department} onChange={(event) => setDepartment(event.target.value as DepartmentKey)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              {DEPARTMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select aria-label="Sortuj działania" value={sortKey} onChange={(event) => { const next = event.target.value as SortKey; setSortKey(next); setSortDirection(next === 'createdAt' ? 'desc' : 'asc'); }} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <option value="orderNumber">Sortuj: numer ZL</option>
              <option value="actionType">Sortuj: rodzaj działania</option>
              <option value="department">Sortuj: dział</option>
              <option value="plannedDate">Sortuj: przewidywana data wykonania</option>
              <option value="createdAt">Sortuj: data dodania</option>
            </select>
            <button type="button" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <ArrowUpDown className="h-3.5 w-3.5" />{sortDirection === 'asc' ? 'Rosnąco' : 'Malejąco'}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Filtr domyślnie odpowiada działowi zalogowanego profilu. Możesz wybrać dowolny dział lub wszystkie działy. Pozycje są wyliczane z danych źródłowych i nie zmieniają statusów zleceń.</p>
        </div>

        {visibleActions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <h2 className="text-sm font-bold text-slate-800">Brak czynności spełniających wybrane kryteria</h2>
            <p className="mt-1 text-xs text-slate-500">Zmień filtr działu lub sprawdź aktualne statusy i terminy elementów.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">ZL / projekt</th>
                  <th className="px-4 py-3">Rodzaj działania</th>
                  <th className="px-4 py-3">Dział</th>
                  <th className="px-4 py-3">Przewidywana data</th>
                  <th className="px-4 py-3">Dodano</th>
                  <th className="px-4 py-3">Stan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleActions.map((action) => (
                  <tr key={action.id} className="align-top hover:bg-blue-50/40">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => onSelectOrder(action.orderId)} className="text-left text-xs font-bold text-blue-700 hover:underline">{action.orderNumber}</button>
                      <div className="mt-1 max-w-[180px] whitespace-normal text-[11px] text-slate-500">{action.projectName || action.client}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-[220px] whitespace-normal text-xs font-semibold text-slate-800">{action.actionType}</div>
                      <div className="mt-1 max-w-sm whitespace-normal text-[11px] text-slate-500">{action.reason}</div>
                      {action.source === 'door' && onOpenDoorModule && <button type="button" onClick={onOpenDoorModule} className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline">Otwórz moduł Drzwi</button>}
                    </td>
                    <td className="px-4 py-3"><span className="whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">{DEPARTMENT_NAMES[action.department]}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{action.plannedDate ? formatDatePL(action.plannedDate) : <span className="text-amber-700">Nie ustalono</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{action.createdAt ? formatDatePL(action.createdAt) : '—'}</td>
                    <td className="px-4 py-3">
                      {action.priority === 'problem' ? <span className="whitespace-nowrap rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700">Problem</span>
                        : action.priority === 'overdue' ? <span className="whitespace-nowrap rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-700"><AlertTriangle className="mr-1 inline h-3 w-3" />Po terminie</span>
                        : action.priority === 'today' ? <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Na dziś</span>
                        : action.priority === 'soon' ? <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Najbliższe 7 dni</span>
                        : action.priority === 'no-date' ? <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">Brak terminu</span>
                        : <span className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">Do wykonania</span>}
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
