import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { ITEM_DEFINITIONS, Order, OrderItem, formatDatePL } from '../types/enco';

interface CalendarViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
  onSaveOrderChanges: (order: Order) => boolean | void | Promise<boolean | void>;
  canEditDates?: boolean;
}

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthLabel = (date: Date) => date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
const todayISO = () => toISODate(new Date());

const plannedDateOf = (order: Order) =>
  order.departureDate || order.items?.find((item) => item.type === 'DATA_WYJAZDU')?.plannedDate || '';

const actualDateOf = (order: Order) =>
  order.items?.find((item) => item.type === 'DATA_WYJAZDU')?.completedDate || '';

const calendarDateOf = (order: Order) => actualDateOf(order) || plannedDateOf(order);

const daysUntil = (dateISO: string, referenceISO: string) => {
  if (!dateISO) return Number.POSITIVE_INFINITY;
  const date = new Date(dateISO + 'T12:00:00');
  const reference = new Date(referenceISO + 'T12:00:00');
  if (Number.isNaN(date.getTime()) || Number.isNaN(reference.getTime())) return Number.POSITIVE_INFINITY;
  return Math.round((date.getTime() - reference.getTime()) / 86400000);
};

const departureBorderClass = (order: Order, today: string) => {
  if (actualDateOf(order)) return 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950';
  if (plannedDateOf(order) && daysUntil(plannedDateOf(order), today) <= 10) {
    return 'border-2 border-rose-500 bg-rose-50 text-rose-950';
  }
  return 'border-2 border-amber-400 bg-amber-50 text-amber-950';
};

const departureTitle = (order: Order) =>
  order.orderNumber + ' · ' + order.projectName +
  ' · Planowana: ' + (plannedDateOf(order) ? formatDatePL(plannedDateOf(order)) : 'brak') +
  ' · Rzeczywista: ' + (actualDateOf(order) ? formatDatePL(actualDateOf(order)) : 'brak');

export const CalendarView: React.FC<CalendarViewProps> = ({
  orders,
  onSelectOrder,
  onSaveOrderChanges,
  canEditDates = true,
}) => {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [stationType, setStationType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dailyLimit, setDailyLimit] = useState(() => {
    const saved = Number(localStorage.getItem('enco_calendar_daily_limit') || 3);
    return Number.isFinite(saved) && saved >= 1 ? Math.min(99, Math.floor(saved)) : 3;
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const activeOrders = useMemo(() => orders.filter((order) => !order.archivedAt), [orders]);
  const filteredOrders = useMemo(() => activeOrders.filter((order) => {
    const query = search.trim().toLowerCase();
    if (query && ![order.orderNumber, order.client, order.projectName, order.stationSize].some((value) => (value || '').toLowerCase().includes(query))) return false;
    const size = (order.stationSize || '').toUpperCase();
    if (stationType === 'BEK' && !size.includes('BEK')) return false;
    if (stationType === 'NZ' && !size.includes('NZ')) return false;
    if (stationType === 'other' && (size.includes('BEK') || size.includes('NZ'))) return false;
    if (statusFilter === 'ready' && order.status !== 'READY') return false;
    if (statusFilter === 'problem' && order.status !== 'PROBLEM' && !order.items.some((item) => item.status === 'PROBLEM')) return false;
    if (statusFilter === 'active' && order.status === 'READY') return false;
    return true;
  }), [activeOrders, search, stationType, statusFilter]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, key: toISODate(date), inMonth: date.getMonth() === visibleMonth.getMonth() };
    });
  }, [visibleMonth]);

  const today = todayISO();
  const monthOrders = filteredOrders.filter((order) => {
    const eventDate = calendarDateOf(order);
    if (!eventDate) return false;
    const date = new Date(eventDate + 'T12:00:00');
    return date.getFullYear() === visibleMonth.getFullYear() && date.getMonth() === visibleMonth.getMonth();
  });
  const undatedCount = filteredOrders.filter((order) => !calendarDateOf(order)).length;

  const changeLimit = (value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(1, Math.min(99, Math.floor(value))) : 1;
    setDailyLimit(safeValue);
    localStorage.setItem('enco_calendar_daily_limit', String(safeValue));
  };

  const shiftMonth = (delta: number) =>
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setSelectedOrderId('');
    setOrderQuery('');
    setPlannedDate('');
    setActualDate('');
    setSuggestionsOpen(false);
    setSaveError('');
  };

  const openAddModal = () => {
    setSelectedOrderId('');
    setOrderQuery('');
    setPlannedDate('');
    setActualDate('');
    setSaveError('');
    setSuggestionsOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (order: Order) => {
    setSelectedOrderId(order.id);
    setOrderQuery(order.orderNumber + ' · ' + (order.projectName || order.stationSize || order.client));
    setPlannedDate(plannedDateOf(order));
    setActualDate(actualDateOf(order));
    setSaveError('');
    setSuggestionsOpen(false);
    setIsModalOpen(true);
  };

  const matchingOrders = activeOrders
    .filter((order) => {
      const query = orderQuery.trim().toLowerCase();
      return !query || [order.orderNumber, order.projectName, order.client, order.stationSize]
        .some((value) => (value || '').toLowerCase().includes(query));
    })
    .slice(0, 8);

  const chooseOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setOrderQuery(order.orderNumber + ' · ' + (order.projectName || order.stationSize || order.client));
    setPlannedDate(plannedDateOf(order));
    setActualDate(actualDateOf(order));
    setSuggestionsOpen(false);
    setSaveError('');
  };

  const handleSaveDates = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEditDates || saving) return;
    const order = activeOrders.find((entry) => entry.id === selectedOrderId);
    if (!order) {
      setSaveError('Najpierw wybierz zlecenie z listy podpowiedzi.');
      setSuggestionsOpen(true);
      return;
    }

    setSaving(true);
    setSaveError('');
    const now = new Date().toISOString();
    const definition = ITEM_DEFINITIONS.find((entry) => entry.type === 'DATA_WYJAZDU');
    const existingDepartureItem = order.items.find((item) => item.type === 'DATA_WYJAZDU');
    const updatedDepartureItem: OrderItem = existingDepartureItem
      ? { ...existingDepartureItem, plannedDate, completedDate: actualDate, updatedAt: now }
      : {
          id: order.id + '_data_wyjazdu',
          orderId: order.id,
          type: 'DATA_WYJAZDU',
          name: definition?.name || 'DATA WYJAZDU',
          shortName: definition?.shortName || 'WYJAZD',
          status: 'NOT_ORDERED',
          orderDate: '',
          plannedDate,
          completedDate: actualDate,
          notes: '',
          details: {},
          attachments: [],
          createdAt: now,
          updatedAt: now,
        };
    const updatedOrder: Order = {
      ...order,
      departureDate: plannedDate,
      items: existingDepartureItem
        ? order.items.map((item) => item.id === existingDepartureItem.id ? updatedDepartureItem : item)
        : [...order.items, updatedDepartureItem],
      updatedAt: now,
    };

    try {
      const saved = await onSaveOrderChanges(updatedOrder);
      if (saved === false) {
        setSaveError('Nie udało się zapisać dat na serwerze. Zmiany pozostają lokalnie — możesz ponowić próbę.');
        return;
      }
      setIsModalOpen(false);
      setSelectedOrderId('');
      setOrderQuery('');
      setPlannedDate('');
      setActualDate('');
      setSuggestionsOpen(false);
      setSaveError('');
    } catch {
      setSaveError('Nie udało się zapisać dat. Zmiany mogą być zapisane lokalnie — sprawdź komunikat aplikacji i spróbuj ponownie.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 pb-6">
      <div>
        <div className="flex items-center gap-2 text-blue-700"><CalendarDays className="h-6 w-6" /><span className="text-xs font-bold uppercase tracking-wider">Planowanie logistyki</span></div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Kalendarz wyjazdów</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Zlecenia są przypisane do rzeczywistego terminu, jeśli został wpisany, w przeciwnym razie do terminu planowanego.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.82fr)] 2xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 px-3 py-3 sm:flex-row sm:items-center sm:px-4">
            <div>
              <h2 className="text-base font-bold capitalize text-slate-900 sm:text-lg">{monthLabel(visibleMonth)}</h2>
              <p className="text-[11px] text-slate-500">Kliknij ramkę ZL, aby edytować daty.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setVisibleMonth(startOfMonth(new Date()))} className="rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] font-semibold hover:bg-slate-200 sm:text-xs">Dziś</button>
              <button type="button" aria-label="Poprzedni miesiąc" onClick={() => shiftMonth(-1)} className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="Następny miesiąc" onClick={() => shiftMonth(1)} className="rounded-lg bg-slate-100 p-2 hover:bg-slate-200"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 bg-slate-50/80">{['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map((day) => <div key={day} className="px-0.5 py-2 text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:px-1 sm:text-[10px]">{day}</div>)}</div>
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, key, inMonth }) => {
              const dayOrders = filteredOrders
                .filter((order) => calendarDateOf(order) === key)
                .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'pl'));
              const overloaded = dayOrders.length > dailyLimit;
              return (
                <div key={key} className={'min-h-[96px] min-w-0 p-1 sm:min-h-[108px] sm:p-1.5 2xl:min-h-[118px] ' + (inMonth ? 'bg-white' : 'bg-slate-50/60') + (overloaded ? ' bg-rose-50/70' : '')}>
                  <div className="mb-1 flex items-center justify-between gap-0.5">
                    <span className={'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-6 sm:w-6 sm:text-xs ' + (key === today ? 'bg-blue-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-300')}>{date.getDate()}</span>
                    {dayOrders.length > 0 && <span className={'rounded px-1 py-0.5 text-[9px] font-bold ' + (overloaded ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600')}>{dayOrders.length}</span>}
                  </div>
                  {overloaded && <div className="mb-1 flex items-center gap-1 text-[9px] font-bold text-rose-700"><AlertTriangle className="h-3 w-3 shrink-0" /><span className="hidden 2xl:inline">Limit</span><span className="2xl:hidden">!</span></div>}
                  <div className="space-y-1">
                    {dayOrders.map((order) => {
                      const actual = actualDateOf(order);
                      const planned = plannedDateOf(order);
                      return (
                        <button key={order.id} type="button" onClick={() => openEditModal(order)} title={departureTitle(order)} className={'block w-full min-w-0 rounded-md px-1 py-1 text-left text-[9px] leading-tight transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 sm:rounded-lg sm:px-1.5 sm:py-1.5 sm:text-[10px] ' + departureBorderClass(order, today)}>
                          <span className="block truncate font-bold">{order.orderNumber}</span>
                          <span className="hidden truncate xl:block">{order.projectName || order.stationSize || order.client}</span>
                          <span className="mt-0.5 block truncate text-[8px] font-semibold sm:text-[9px]">{actual ? 'Rzeczywista' : 'Planowana'}: {formatDatePL(actual || planned)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="min-w-0 space-y-3">
          {canEditDates && (
            <button type="button" onClick={openAddModal} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <Plus className="h-4 w-4" /> Dodaj datę wyjazdu
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] text-slate-500">Wyjazdy w miesiącu</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{monthOrders.length}</p>
            </div>
            <div className="rounded-xl bg-white px-3 py-3 shadow-sm">
              <p className="text-[11px] text-slate-500">Przepełnione dni</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">{calendarDays.filter(({ key, inMonth }) => inMonth && filteredOrders.filter((order) => calendarDateOf(order) === key).length > dailyLimit).length}</p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Limit stacji / dzień</span>
              <input aria-label="Limit stacji na dzień" type="number" min={1} max={99} value={dailyLimit} onChange={(event) => changeLimit(Number(event.target.value))} className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </label>
          </div>

          <div className="space-y-3 rounded-xl bg-white p-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj ZL, klienta, stacji..." className="w-full rounded-lg bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none ring-blue-500 focus:bg-white focus:ring-2" />
            </div>
            <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 shrink-0 text-slate-400" /><span className="text-xs font-semibold text-slate-700">Filtry</span></div>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Typ stacji</span>
              <select value={stationType} onChange={(event) => setStationType(event.target.value)} aria-label="Filtr typu stacji" className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm"><option value="all">Wszystkie typy</option><option value="BEK">BEK</option><option value="NZ">NZ</option><option value="other">Pozostałe</option></select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">Status zlecenia</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtr statusu" className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm"><option value="all">Wszystkie statusy</option><option value="active">W realizacji</option><option value="ready">Gotowe</option><option value="problem">Z problemem</option></select>
            </label>
          </div>

          <div className="rounded-xl bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-xs font-bold text-slate-800">Oznaczenia kalendarza</h3>
            <div className="space-y-2 text-[11px] text-slate-600">
              <span className="flex items-start gap-2"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-2 border-amber-400 bg-amber-50" /><span>Planowana data</span></span>
              <span className="flex items-start gap-2"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-2 border-emerald-500 bg-emerald-50" /><span>Rzeczywista data</span></span>
              <span className="flex items-start gap-2"><span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-2 border-rose-500 bg-rose-50" /><span>Brak daty rzeczywistej, do wyjazdu ≤ 10 dni lub termin minął</span></span>
              <span className="flex items-start gap-2"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm bg-rose-200" /><span>Dzienny limit przekroczony</span></span>
            </div>
          </div>

          {undatedCount > 0 && <div className="rounded-xl bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">{undatedCount} zleceń po zastosowaniu filtrów nie ma żadnej daty wyjazdu i nie pojawia się w kalendarzu.</div>}
          {filteredOrders.length === 0 && <div className="rounded-xl bg-white p-4 text-center text-xs text-slate-500 shadow-sm">Brak zleceń pasujących do wybranych filtrów.</div>}
        </aside>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="departure-modal-title" className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 px-5 py-4 sm:px-6">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-700">Planowanie logistyki</p><h2 id="departure-modal-title" className="mt-1 text-lg font-bold text-slate-900">{selectedOrderId ? 'Edytuj daty wyjazdu' : 'Dodaj datę wyjazdu'}</h2><p className="mt-1 text-xs text-slate-500">Daty zostaną zapisane w nagłówku zlecenia i w elemencie „Data wyjazdu”.</p></div>
              <button type="button" onClick={closeModal} disabled={saving} aria-label="Zamknij okno" className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-50"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSaveDates} className="space-y-5 px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="relative">
                <label htmlFor="departure-order-search" className="mb-1.5 block text-xs font-semibold text-slate-700">Wybierz zlecenie (numer ZL lub nazwa stacji)</label>
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input id="departure-order-search" autoComplete="off" value={orderQuery} disabled={!canEditDates || saving} onFocus={() => setSuggestionsOpen(true)} onChange={(event) => { setOrderQuery(event.target.value); setSelectedOrderId(''); setPlannedDate(''); setActualDate(''); setSuggestionsOpen(true); setSaveError(''); }} placeholder="Np. ZL86 lub Mroźna..." className="w-full rounded-xl bg-slate-50 py-3 pl-10 pr-3 text-sm outline-none ring-blue-500 focus:bg-white focus:ring-2 disabled:opacity-60" />
                {selectedOrderId && <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Wybrano</span>}</div>
                {suggestionsOpen && !selectedOrderId && canEditDates && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
                    {matchingOrders.length ? matchingOrders.map((order) => <button key={order.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseOrder(order)} className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-blue-50"><span className="text-sm font-bold text-slate-800">{order.orderNumber} <span className="font-normal text-slate-500">· {order.projectName || order.stationSize || 'Bez nazwy stacji'}</span></span><span className="text-xs text-slate-500">{order.client}</span></button>) : <p className="px-3 py-4 text-sm text-slate-500">Brak pasujących aktywnych zleceń.</p>}
                  </div>
                )}
              </div>

              {selectedOrderId ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-amber-400" />Planowana data wyjazdu</span><input type="date" value={plannedDate} disabled={!canEditDates || saving} onChange={(event) => setPlannedDate(event.target.value)} className="w-full rounded-xl bg-amber-50/70 px-3 py-3 text-sm text-slate-900 outline-none ring-amber-500 focus:ring-2 disabled:opacity-60" /></label>
                    <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />Rzeczywista data wyjazdu</span><input type="date" value={actualDate} disabled={!canEditDates || saving} onChange={(event) => setActualDate(event.target.value)} className="w-full rounded-xl bg-emerald-50/70 px-3 py-3 text-sm text-slate-900 outline-none ring-emerald-500 focus:ring-2 disabled:opacity-60" /></label>
                  </div>
                  {actualDate && plannedDate && actualDate !== plannedDate && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">W kalendarzu to zlecenie będzie pokazane tylko w dniu rzeczywistego wyjazdu.</p>}
                </div>
              ) : <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">Wybierz zlecenie, aby pobrać i edytować jego daty.</p>}

              {saveError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{saveError}</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" onClick={() => { const chosen = activeOrders.find((order) => order.id === selectedOrderId); if (chosen) onSelectOrder(chosen.id); }} disabled={!selectedOrderId || saving} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ExternalLink className="h-4 w-4" />Przejdź do ZL</button>
                <div className="flex gap-2"><button type="button" onClick={closeModal} disabled={saving} className="flex-1 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 sm:flex-none">Anuluj</button>{canEditDates && <button type="submit" disabled={!selectedOrderId || saving} className="flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{saving ? 'Zapisywanie…' : 'Zapisz daty'}</button>}</div>
              </div>
              {!canEditDates && <p className="text-[11px] text-slate-500">Twój profil ma dostęp tylko do odczytu dat wyjazdu.</p>}
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
